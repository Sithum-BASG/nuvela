import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 10 happy paths (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mailServiceMock = {
    sendVerificationEmail: jest.fn<Promise<void>, [string, string]>(),
    sendPasswordResetEmail: jest.fn<Promise<void>, [string, string]>(),
    sendTempPasswordEmail: jest.fn<Promise<void>, [string, string, string]>(),
  };

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `owner-happy-${suffix}@example.com`;
  const password = 'Str0ngPass!';
  const orgName = `Happy Path Org ${suffix}`;

  let organizationId: string;
  let ownerId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.RESEND_API_KEY = 'test-resend-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
  }, 30000);

  afterAll(async () => {
    if (organizationId) {
      await cleanupOrganization(prisma, organizationId, ownerId);
    }
    await app.close();
  }, 30000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owner signs up, verifies, creates a project and task, and completes it', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Happy Owner',
        email,
        password,
        orgName,
      })
      .expect(201);

    const organization = await prisma.organization.findFirstOrThrow({
      where: { name: orgName },
      include: { users: true },
    });
    organizationId = organization.id;
    ownerId = organization.users[0].id;

    const verificationLink =
      mailServiceMock.sendVerificationEmail.mock.calls[0][1];
    const verificationToken = new URL(verificationLink).searchParams.get(
      'token',
    );

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: verificationToken })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const authCookies = cookieHeader(loginResponse);

    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Cookie', authCookies)
      .send({
        name: 'Launch Board',
        description: 'Phase 10 happy path',
        color: '#7c74d6',
      })
      .expect(201);

    const projectId = responseBody<{ id: string }>(projectResponse).id;
    expect(projectId).toBeTruthy();

    const columnsResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/columns`)
      .set('Cookie', authCookies)
      .expect(200);

    const columns = responseBody<{ id: string; name: string }[]>(
      columnsResponse,
    );
    const completedColumn = columns.find((col) => col.name === 'Completed');
    const todoColumn = columns.find((col) => col.name === 'To Do');
    expect(completedColumn).toBeDefined();
    expect(todoColumn).toBeDefined();

    const taskResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Cookie', authCookies)
      .send({ title: 'Ship Phase 10 tests' })
      .expect(201);

    const taskId = responseBody<{ id: string; columnId: string }>(
      taskResponse,
    ).id;
    expect(responseBody<{ columnId: string }>(taskResponse).columnId).toBe(
      todoColumn!.id,
    );

    const moveResponse = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/move`)
      .set('Cookie', authCookies)
      .send({ columnId: completedColumn!.id, position: 0 })
      .expect(200);

    expect(responseBody<{ columnId: string }>(moveResponse).columnId).toBe(
      completedColumn!.id,
    );

    const taskDetail = await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(responseBody<{ columnId: string }>(taskDetail).columnId).toBe(
      completedColumn!.id,
    );
  }, 60000);
});

async function cleanupOrganization(
  prisma: PrismaService,
  organizationId: string,
  ownerId: string,
): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length > 0) {
    await prisma.activityLog.deleteMany({
      where: { taskId: { in: taskIds } },
    });
    await prisma.commentMention.deleteMany({
      where: { comment: { taskId: { in: taskIds } } },
    });
    await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.attachment.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.checklistItem.deleteMany({
      where: { taskId: { in: taskIds } },
    });
    await prisma.taskLabel.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskAssignee.deleteMany({
      where: { taskId: { in: taskIds } },
    });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  }

  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.label.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.column.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.projectMember.deleteMany({
    where: { project: { organizationId } },
  });
  await prisma.project.deleteMany({ where: { organizationId } });
  await prisma.refreshToken.deleteMany({ where: { userId: ownerId } });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { ownerId: null },
  });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}

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

function responseBody<T>(response: SupertestResponse): T {
  return response.body as T;
}
