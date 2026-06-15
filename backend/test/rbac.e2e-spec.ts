import type { INestApplication } from '@nestjs/common';
import { Controller, Get, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllowWhileMustReset } from '../src/common/decorators/allow-while-must-reset.decorator';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../src/common/decorators/current-user.decorator';
import { Roles } from '../src/common/decorators/roles.decorator';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_ACCESS_SECRET = 'test-access-secret';

@Controller('rbac-test/authenticated')
class RbacAuthenticatedController {
  @Get()
  @AllowWhileMustReset()
  check(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }
}

@Controller('rbac-test/admin')
class RbacAdminController {
  @Get()
  @AllowWhileMustReset()
  @Roles(Role.ADMIN)
  check(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }
}

@Controller('rbac-test/project-manager')
class RbacProjectManagerController {
  @Get()
  @AllowWhileMustReset()
  @Roles(Role.PROJECT_MANAGER)
  check(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }
}

describe('RBAC permission matrix (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let meUserId: string;
  let meOrganizationId: string;

  const mailServiceMock = {
    sendVerificationEmail: jest.fn<Promise<void>, [string, string]>(),
    sendPasswordResetEmail: jest.fn<Promise<void>, [string, string]>(),
    sendTempPasswordEmail: jest.fn<Promise<void>, [string, string, string]>(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.RESEND_API_KEY = 'test-resend-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [
        RbacAuthenticatedController,
        RbacAdminController,
        RbacProjectManagerController,
      ],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    prisma = app.get(PrismaService);

    const unique = randomUUID();
    const organization = await prisma.organization.create({
      data: { name: `RBAC Me Org ${unique}` },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `rbac-me-${unique}@example.com`,
        name: 'RBAC Me User',
        passwordHash: 'not-used-by-this-test',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        mustResetPassword: false,
      },
    });

    meOrganizationId = organization.id;
    meUserId = user.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.refreshToken.deleteMany({ where: { userId: meUserId } });
      await prisma.organization.updateMany({
        where: { id: meOrganizationId },
        data: { ownerId: null },
      });
      await prisma.user.deleteMany({ where: { id: meUserId } });
      await prisma.organization.deleteMany({
        where: { id: meOrganizationId },
      });
    }

    await app.close();
  });

  // Cross-tenant 404 is enforced per feature service starting in Phase 4; no
  // feature resources are exposed yet, so this suite focuses on Phase 3 guards.
  it('enforces 401 vs 403 and the Owner role superset on protected routes', async () => {
    await request(app.getHttpServer())
      .get('/rbac-test/authenticated')
      .expect(401);

    await request(app.getHttpServer())
      .get('/rbac-test/admin')
      .set('Cookie', [await accessCookie(Role.COLLABORATOR)])
      .expect(403);

    await request(app.getHttpServer())
      .get('/rbac-test/admin')
      .set('Cookie', [await accessCookie(Role.ADMIN)])
      .expect(200);

    await request(app.getHttpServer())
      .get('/rbac-test/admin')
      .set('Cookie', [await accessCookie(Role.PROJECT_MANAGER)])
      .expect(403);

    await request(app.getHttpServer())
      .get('/rbac-test/admin')
      .set('Cookie', [await accessCookie(Role.OWNER)])
      .expect(200);

    await request(app.getHttpServer())
      .get('/rbac-test/project-manager')
      .set('Cookie', [await accessCookie(Role.OWNER)])
      .expect(200);

    await request(app.getHttpServer())
      .get('/rbac-test/project-manager')
      .set('Cookie', [await accessCookie(Role.ADMIN)])
      .expect(403);

    await request(app.getHttpServer())
      .get('/rbac-test/authenticated')
      .set('Cookie', ['access_token=not-a-jwt'])
      .expect(401);
  }, 30000);

  it('returns the current user from GET /auth/me only with a valid cookie', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [
        await accessCookie(Role.ADMIN, {
          userId: meUserId,
          organizationId: meOrganizationId,
        }),
      ])
      .expect(200)
      .expect(({ body }) => {
        const me = body as {
          id: string;
          name: string;
          email: string;
          role: Role;
          organizationId: string;
          mustResetPassword: boolean;
        };
        expect(me.id).toBe(meUserId);
        expect(me.name).toBe('RBAC Me User');
        expect(me.email).toMatch(/^rbac-me-/);
        expect(me.role).toBe(Role.ADMIN);
        expect(me.organizationId).toBe(meOrganizationId);
        expect(me.mustResetPassword).toBe(false);
      });
  }, 30000);

  async function accessCookie(
    role: Role,
    options: { userId?: string; organizationId?: string } = {},
  ): Promise<string> {
    const accessToken = await jwtService.signAsync(
      {
        sub: options.userId ?? `rbac-${role.toLowerCase()}-user`,
        role,
        organizationId: options.organizationId ?? 'org-a',
      },
      { secret: TEST_ACCESS_SECRET },
    );

    return `access_token=${accessToken}`;
  }
});
