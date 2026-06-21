import type { INestApplication } from '@nestjs/common';
import { Controller, Get, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

@Controller('test-protected')
class TestProtectedController {
  @Get()
  check(): { ok: boolean } {
    return { ok: true };
  }
}

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  const mailServiceMock = {
    sendVerificationEmail: jest.fn<Promise<void>, [string, string]>(),
    sendPasswordResetEmail: jest.fn<Promise<void>, [string, string]>(),
    sendTempPasswordEmail: jest.fn<Promise<void>, [string, string, string]>(),
  };

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `owner-${suffix}@example.com`;
  const password = 'Str0ngPass!';
  const orgName = `Nuvela Test Org ${suffix}`;
  const createdOrganizationIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.RESEND_API_KEY = 'test-resend-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestProtectedController],
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

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.organization.updateMany({
      where: { id: { in: createdOrganizationIds } },
      data: { ownerId: null },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrganizationIds } },
    });
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs up an owner, verifies email, logs in, refreshes, logs out, and avoids forgot-password enumeration', async () => {
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Test Owner',
        email,
        password,
        orgName,
      })
      .expect(201);

    expect(hasAuthCookie(signupResponse)).toBe(false);
    expect(mailServiceMock.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
      email,
      expect.stringContaining('/verify-email?token='),
    );

    const organization = await prisma.organization.findFirstOrThrow({
      where: { name: orgName },
      include: { users: true },
    });
    const owner = organization.users[0];
    createdOrganizationIds.push(organization.id);
    createdUserIds.push(owner.id);

    expect(organization.ownerId).toBe(owner.id);
    expect(owner.email).toBe(email);
    expect(owner.role).toBe('OWNER');
    expect(owner.status).toBe('PENDING');
    expect(owner.emailVerified).toBe(false);

    const loginBeforeVerify = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);
    expect(responseBody<{ code: string }>(loginBeforeVerify).code).toBe(
      'EMAIL_NOT_VERIFIED',
    );

    const verificationLink =
      mailServiceMock.sendVerificationEmail.mock.calls[0][1];
    const verificationToken = new URL(verificationLink).searchParams.get(
      'token',
    );
    expect(verificationToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: verificationToken })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(responseBody<Record<string, unknown>>(loginResponse)).toEqual({
      user: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: 'OWNER',
        organizationId: organization.id,
      },
      mustResetPassword: false,
    });
    expect(cookieHeaders(loginResponse)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    );
    expect(
      cookieHeaders(loginResponse).some(
        (cookie) =>
          cookie.startsWith('access_token=') && cookie.includes('HttpOnly'),
      ),
    ).toBe(true);

    const loginCookies = cookieHeader(loginResponse);
    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', loginCookies)
      .expect(200);

    expect(cookieHeaders(refreshResponse)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    );
    expect(refreshCookieValue(refreshResponse)).not.toEqual(
      refreshCookieValue(loginResponse),
    );

    const revokedTokens = await prisma.refreshToken.count({
      where: { userId: owner.id, revokedAt: { not: null } },
    });
    expect(revokedTokens).toBeGreaterThanOrEqual(1);

    const refreshedCookies = cookieHeader(refreshResponse);
    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshedCookies)
      .expect(200);

    expect(cookieHeaders(logoutResponse)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('refresh_token=;'),
      ]),
    );

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: `missing-${suffix}@example.com` })
      .expect(200);
    expect(mailServiceMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  }, 30000);

  it('rolls back the new org and owner when the verification email fails', async () => {
    const failSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const failEmail = `rollback-${failSuffix}@example.com`;
    const failOrgName = `Rollback Org ${failSuffix}`;

    mailServiceMock.sendVerificationEmail.mockRejectedValueOnce(
      new Error('Resend unavailable'),
    );

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Rollback Owner',
        email: failEmail,
        password,
        orgName: failOrgName,
      })
      .expect(500);

    // The compensating rollback must leave no orphaned org or owner behind, so
    // the email can be retried with the same address later.
    const org = await prisma.organization.findFirst({
      where: { name: failOrgName },
    });
    expect(org).toBeNull();
    const user = await prisma.user.findFirst({ where: { email: failEmail } });
    expect(user).toBeNull();
  }, 30000);

  it('logs in with the verified account when the same email has a pending duplicate', async () => {
    const dupSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dupEmail = `dup-login-${dupSuffix}@example.com`;
    const dupPassword = 'Str0ngPass!';
    const firstOrgName = `Dup Org A ${dupSuffix}`;
    const secondOrgName = `Dup Org B ${dupSuffix}`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Dup Owner',
        email: dupEmail,
        password: dupPassword,
        orgName: firstOrgName,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Dup Owner',
        email: dupEmail,
        password: dupPassword,
        orgName: secondOrgName,
      })
      .expect(201);

    const pendingOwner = await prisma.user.findFirstOrThrow({
      where: { email: dupEmail, organization: { name: firstOrgName } },
    });
    const verifiedOwner = await prisma.user.findFirstOrThrow({
      where: { email: dupEmail, organization: { name: secondOrgName } },
    });
    createdUserIds.push(pendingOwner.id, verifiedOwner.id);
    createdOrganizationIds.push(
      pendingOwner.organizationId,
      verifiedOwner.organizationId,
    );

    const secondVerificationLink =
      mailServiceMock.sendVerificationEmail.mock.calls.at(-1)?.[1];
    const secondToken = new URL(secondVerificationLink!).searchParams.get(
      'token',
    );

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: secondToken })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: dupEmail, password: dupPassword })
      .expect(200);

    expect(responseBody<{ user: { id: string } }>(loginResponse).user.id).toBe(
      verifiedOwner.id,
    );
  }, 30000);

  describe('MustResetPassword guard flow', () => {
    jest.setTimeout(30000);

    it('blocks protected routes until the first-login password reset clears the flag', async () => {
      const mustResetSuffix = randomUUID();
      const mustResetEmail = `must-reset-${mustResetSuffix}@example.com`;
      const newPassword = 'NewPassw0rd!';

      const organization = await prisma.organization.create({
        data: { name: `Must Reset Org ${mustResetSuffix}` },
      });
      createdOrganizationIds.push(organization.id);

      const user = await authService.provisionUser({
        organizationId: organization.id,
        email: mustResetEmail,
        name: 'Must Reset User',
        role: Role.ADMIN,
      });
      createdUserIds.push(user.id);

      expect(user.mustResetPassword).toBe(true);
      expect(user.tempPasswordExpiresAt).toBeInstanceOf(Date);
      expect(mailServiceMock.sendTempPasswordEmail).toHaveBeenCalledWith(
        mustResetEmail,
        expect.any(String),
        'http://localhost:3000/login',
      );

      const tempPassword =
        mailServiceMock.sendTempPasswordEmail.mock.calls[0][1];
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: mustResetEmail, password: tempPassword })
        .expect(200);

      expect(
        responseBody<{ mustResetPassword: boolean }>(loginResponse)
          .mustResetPassword,
      ).toBe(true);

      const authCookies = cookieHeader(loginResponse);
      const blockedResponse = await request(app.getHttpServer())
        .get('/test-protected')
        .set('Cookie', authCookies)
        .expect(403);

      expect(responseBody<{ code: string }>(blockedResponse).code).toBe(
        'MUST_RESET_PASSWORD',
      );

      await request(app.getHttpServer())
        .post('/auth/first-login/reset-password')
        .set('Cookie', authCookies)
        .send({ newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .get('/test-protected')
        .set('Cookie', authCookies)
        .expect(200);

      const updatedUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { mustResetPassword: true },
      });
      expect(updatedUser.mustResetPassword).toBe(false);
    });
  });
});

function cookieHeaders(response: SupertestResponse): string[] {
  const headers = response.headers as Record<
    string,
    string | string[] | undefined
  >;
  const header = headers['set-cookie'];
  if (!header) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

function cookieHeader(response: SupertestResponse): string[] {
  return cookieHeaders(response).map((cookie) => cookie.split(';')[0]);
}

function hasAuthCookie(response: SupertestResponse): boolean {
  return cookieHeaders(response).some(
    (cookie) =>
      cookie.startsWith('access_token=') || cookie.startsWith('refresh_token='),
  );
}

function refreshCookieValue(response: SupertestResponse): string | undefined {
  const refreshCookie = cookieHeaders(response).find((cookie) =>
    cookie.startsWith('refresh_token='),
  );
  return refreshCookie?.split(';')[0];
}

function responseBody<T>(response: SupertestResponse): T {
  return response.body as T;
}
