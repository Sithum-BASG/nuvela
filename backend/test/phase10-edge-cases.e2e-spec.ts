import type { INestApplication } from '@nestjs/common';
import { ConflictException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ProjectStatus, Role } from '@prisma/client';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { MustResetGuard } from '../src/common/guards/must-reset.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';

const TEST_ACCESS_SECRET = 'test-access-secret';

describe('Phase 10 edge cases (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const projectsService = {
    updateProject: jest
      .fn()
      .mockRejectedValue(
        new ConflictException({
          code: 'PROJECT_ARCHIVED',
          message: 'Archived projects are read-only.',
        }),
      ),
    getProject: jest.fn().mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.ARCHIVED,
    }),
  };

  const prismaMock = {
    user: { findUnique: jest.fn().mockResolvedValue(undefined) },
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({}),
        PassportModule,
      ],
      controllers: [ProjectsController],
      providers: [
        JwtStrategy,
        { provide: ProjectsService, useValue: projectsService },
        { provide: PrismaService, useValue: prismaMock },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: MustResetGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function authCookie(role: Role): string[] {
    const token = jwtService.sign(
      { sub: 'user-1', role, organizationId: 'org-1' },
      { secret: TEST_ACCESS_SECRET },
    );
    return [`access_token=${token}`];
  }

  it('rejects updates to archived projects with PROJECT_ARCHIVED', async () => {
    const response = await request(app.getHttpServer())
      .patch('/projects/project-1')
      .set('Cookie', authCookie(Role.PROJECT_MANAGER))
      .send({ name: 'Renamed' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      code: 'PROJECT_ARCHIVED',
      message: 'Archived projects are read-only.',
    });
  });
});
