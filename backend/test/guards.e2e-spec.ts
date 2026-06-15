import { Controller, Get } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { Public } from '../src/common/decorators/public.decorator';
import { Roles } from '../src/common/decorators/roles.decorator';
import type { CurrentUserPayload } from '../src/common/decorators/current-user.decorator';
import type { INestApplication } from '@nestjs/common';

@Controller()
class GuardTestController {
  @Public()
  @Get('public')
  getPublic(): { ok: true } {
    return { ok: true };
  }

  @Get('authed')
  getAuthed(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }

  @Roles(Role.ADMIN)
  @Get('admin-only')
  getAdminOnly(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }
}

describe('Auth guards (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    jwtService = moduleFixture.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /public no cookie returns 200', () => {
    return request(app.getHttpServer()).get('/public').expect(200);
  });

  it('GET /authed no cookie returns 401', () => {
    return request(app.getHttpServer()).get('/authed').expect(401);
  });

  it('GET /authed COLLABORATOR cookie returns 200', () => {
    return request(app.getHttpServer())
      .get('/authed')
      .set('Cookie', [accessCookie(Role.COLLABORATOR)])
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          userId: 'user-COLLABORATOR',
          role: Role.COLLABORATOR,
          organizationId: 'org-1',
        });
      });
  });

  it('GET /admin-only COLLABORATOR cookie returns 403', () => {
    return request(app.getHttpServer())
      .get('/admin-only')
      .set('Cookie', [accessCookie(Role.COLLABORATOR)])
      .expect(403);
  });

  it('GET /admin-only ADMIN cookie returns 200', () => {
    return request(app.getHttpServer())
      .get('/admin-only')
      .set('Cookie', [accessCookie(Role.ADMIN)])
      .expect(200);
  });

  it('GET /admin-only OWNER cookie returns 200', () => {
    return request(app.getHttpServer())
      .get('/admin-only')
      .set('Cookie', [accessCookie(Role.OWNER)])
      .expect(200);
  });

  function accessCookie(role: Role): string {
    const accessToken = jwtService.sign(
      {
        sub: `user-${role}`,
        role,
        organizationId: 'org-1',
      },
      { secret: 'test-access-secret' },
    );

    return `access_token=${accessToken}`;
  }
});
