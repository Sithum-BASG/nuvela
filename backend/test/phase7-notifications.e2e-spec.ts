/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import {
  NotificationType,
  Priority,
  ProjectStatus,
  Role,
} from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { MustResetGuard } from '../src/common/guards/must-reset.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { DeadlineScanner } from '../src/notifications/deadline.scanner';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsGateway } from '../src/notifications/notifications.gateway';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { CommentsController } from '../src/tasks/comments.controller';
import { CommentsService } from '../src/tasks/comments.service';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';
import { ColumnsService } from '../src/columns/columns.service';

const TEST_ACCESS_SECRET = 'test-access-secret';
const ORG = 'org-a';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const COL_TODO = '33333333-3333-4333-8333-333333333331';
const COL_REVIEW = '33333333-3333-4333-8333-333333333332';
const COL_DONE = '33333333-3333-4333-8333-333333333333';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PM_USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type NotificationRow = {
  id: string;
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
};

type Store = {
  notifications: NotificationRow[];
  projects: Array<{
    id: string;
    organizationId: string;
    name: string;
    status: ProjectStatus;
    managerId: string;
    _count: { members: number };
  }>;
  projectMembers: Array<{ projectId: string; userId: string }>;
  columns: Array<{
    id: string;
    projectId: string;
    position: number;
    isCompletedColumn: boolean;
    isPmGated: boolean;
  }>;
  tasks: Array<{
    id: string;
    organizationId: string;
    projectId: string;
    columnId: string;
    title: string;
    description: string | null;
    priority: Priority;
    dueDate: Date | null;
    position: number;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    assignees: Array<{ user: { id: string; name: string; email: string } }>;
    labels: [];
    _count: { checklist: number };
    checklist: [];
    project: {
      status: ProjectStatus;
      managerId: string;
      organizationId: string;
    };
  }>;
  taskAssignees: Array<{ taskId: string; userId: string }>;
  comments: Array<{
    id: string;
    taskId: string;
    authorId: string;
    body: string;
    createdAt: Date;
  }>;
  commentMentions: Array<{ id: string; commentId: string; userId: string }>;
  activityLogs: Array<{
    id: string;
    taskId: string;
    actorId: string;
    type: string;
    metadata: unknown;
  }>;
  users: Array<{ id: string; organizationId: string; role: Role }>;
};

function createStore(): Store {
  const now = new Date();
  return {
    notifications: [
      {
        id: 'n-a-1',
        organizationId: ORG,
        recipientId: USER_A,
        type: NotificationType.TASK_ASSIGNED,
        payload: { taskId: TASK_ID, projectId: PROJECT_ID, title: 'Alpha' },
        isRead: false,
        createdAt: now,
      },
      {
        id: 'n-b-1',
        organizationId: ORG,
        recipientId: USER_B,
        type: NotificationType.MENTION,
        payload: { taskId: TASK_ID, projectId: PROJECT_ID, commentId: 'c-1' },
        isRead: true,
        createdAt: now,
      },
    ],
    projects: [
      {
        id: PROJECT_ID,
        organizationId: ORG,
        name: 'Website',
        status: ProjectStatus.ACTIVE,
        managerId: PM_USER,
        _count: { members: 2 },
      },
    ],
    projectMembers: [
      { projectId: PROJECT_ID, userId: USER_A },
      { projectId: PROJECT_ID, userId: USER_B },
    ],
    columns: [
      {
        id: COL_TODO,
        projectId: PROJECT_ID,
        position: 0,
        isCompletedColumn: false,
        isPmGated: false,
      },
      {
        id: COL_REVIEW,
        projectId: PROJECT_ID,
        position: 2,
        isCompletedColumn: false,
        isPmGated: false,
      },
      {
        id: COL_DONE,
        projectId: PROJECT_ID,
        position: 3,
        isCompletedColumn: true,
        isPmGated: true,
      },
    ],
    tasks: [
      {
        id: TASK_ID,
        organizationId: ORG,
        projectId: PROJECT_ID,
        columnId: COL_TODO,
        title: 'Ship notifications',
        description: null,
        priority: Priority.MEDIUM,
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        position: 0,
        createdById: PM_USER,
        createdAt: now,
        updatedAt: now,
        assignees: [{ user: { id: USER_A, name: 'User A', email: 'a@x.com' } }],
        labels: [],
        _count: { checklist: 0 },
        checklist: [],
        project: {
          status: ProjectStatus.ACTIVE,
          managerId: PM_USER,
          organizationId: ORG,
        },
      },
    ],
    taskAssignees: [{ taskId: TASK_ID, userId: USER_A }],
    comments: [],
    commentMentions: [],
    activityLogs: [],
    users: [
      { id: PM_USER, organizationId: ORG, role: Role.PROJECT_MANAGER },
      { id: USER_B, organizationId: ORG, role: Role.PROJECT_MANAGER },
    ],
  };
}

function createPrisma(storeRef: { store: Store }) {
  let notificationSeq = 0;
  let commentSeq = 0;

  const buildRawTask = (taskId: string) => {
    const t = storeRef.store.tasks.find((row) => row.id === taskId);
    if (!t) return null;
    return {
      ...t,
      assignees: storeRef.store.taskAssignees
        .filter((a) => a.taskId === taskId)
        .map((a) => ({
          user: { id: a.userId, name: 'User', email: 'user@example.com' },
        })),
    };
  };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(undefined),
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { id: string; organizationId: string; role?: { in: Role[] } };
        }) => {
          const row = storeRef.store.users.find(
            (u) =>
              u.id === where.id && u.organizationId === where.organizationId,
          );
          if (!row) return Promise.resolve(null);
          if (where.role && !where.role.in.includes(row.role)) {
            return Promise.resolve(null);
          }
          return Promise.resolve({ id: row.id });
        },
      ),
    },
    notification: {
      findMany: jest.fn(
        ({
          where,
          take,
        }: {
          where: {
            recipientId: string;
            organizationId: string;
            isRead?: boolean;
          };
          take?: number;
        }) => {
          let rows = storeRef.store.notifications.filter(
            (n) =>
              n.recipientId === where.recipientId &&
              n.organizationId === where.organizationId &&
              (where.isRead === undefined || n.isRead === where.isRead),
          );
          rows = rows.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          if (take) rows = rows.slice(0, take);
          return Promise.resolve(rows);
        },
      ),
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: {
            recipientId: string;
            type: NotificationType;
            AND?: Array<{
              payload: { path: string[]; equals: string };
            }>;
          };
        }) => {
          const row = storeRef.store.notifications.find((n) => {
            if (n.recipientId !== where.recipientId || n.type !== where.type) {
              return false;
            }
            const filters = where.AND ?? [];
            return filters.every((f) => {
              const key = f.payload.path[0];
              return n.payload[key] === f.payload.equals;
            });
          });
          return Promise.resolve(row ?? null);
        },
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: {
            organizationId: string;
            recipientId: string;
            type: NotificationType;
            payload: Record<string, unknown>;
          };
        }) => {
          const row: NotificationRow = {
            id: `n-${++notificationSeq}`,
            organizationId: data.organizationId,
            recipientId: data.recipientId,
            type: data.type,
            payload: data.payload,
            isRead: false,
            createdAt: new Date(),
          };
          storeRef.store.notifications.push(row);
          return Promise.resolve(row);
        },
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id?: string; recipientId?: string; isRead?: boolean };
          data: { isRead: boolean };
        }) => {
          let count = 0;
          for (const row of storeRef.store.notifications) {
            const idMatch = !where.id || row.id === where.id;
            const recipientMatch =
              !where.recipientId || row.recipientId === where.recipientId;
            const readMatch =
              where.isRead === undefined || row.isRead === where.isRead;
            if (idMatch && recipientMatch && readMatch) {
              row.isRead = data.isRead;
              count++;
            }
          }
          return Promise.resolve({ count });
        },
      ),
    },
    project: {
      findFirst: jest.fn(
        ({ where }: { where: { id: string; organizationId: string } }) => {
          const row = storeRef.store.projects.find(
            (p) =>
              p.id === where.id && p.organizationId === where.organizationId,
          );
          return Promise.resolve(row ?? null);
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { managerId: string };
        }) => {
          const row = storeRef.store.projects.find((p) => p.id === where.id);
          if (!row) throw new Error('missing project');
          row.managerId = data.managerId;
          return Promise.resolve(row);
        },
      ),
    },
    projectMember: {
      findUnique: jest.fn(
        ({
          where: { projectId_userId },
        }: {
          where: { projectId_userId: { projectId: string; userId: string } };
        }) => {
          const row = storeRef.store.projectMembers.find(
            (m) =>
              m.projectId === projectId_userId.projectId &&
              m.userId === projectId_userId.userId,
          );
          return Promise.resolve(row ? { id: 'mem' } : null);
        },
      ),
      upsert: jest.fn().mockResolvedValue({}),
    },
    column: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { id?: string; projectId?: string };
          orderBy?: { position: 'asc' | 'desc' };
        }) => {
          let rows = storeRef.store.columns.filter((c) => {
            if (where.id && c.id !== where.id) return false;
            if (where.projectId && c.projectId !== where.projectId)
              return false;
            return true;
          });
          if (rows.length > 1) {
            rows = [...rows].sort((a, b) => a.position - b.position);
          }
          return Promise.resolve(rows[0] ?? null);
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    task: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            dueDate?: { not: null; lte: Date };
            project?: { status: ProjectStatus };
            column?: { isCompletedColumn: boolean };
            columnId?: string;
            id?: { not: string };
          };
        }) => {
          if (where.dueDate) {
            const in24h = where.dueDate.lte;
            const rows = storeRef.store.tasks.filter((t) => {
              if (!t.dueDate || t.dueDate > in24h) return false;
              if (
                where.project?.status &&
                t.project.status !== where.project.status
              ) {
                return false;
              }
              const column = storeRef.store.columns.find(
                (c) => c.id === t.columnId,
              );
              if (
                where.column?.isCompletedColumn === false &&
                column?.isCompletedColumn
              ) {
                return false;
              }
              return true;
            });
            return Promise.resolve(
              rows.map((t) => ({
                id: t.id,
                organizationId: t.organizationId,
                projectId: t.projectId,
                title: t.title,
                dueDate: t.dueDate,
                assignees: storeRef.store.taskAssignees
                  .filter((a) => a.taskId === t.id)
                  .map((a) => ({ userId: a.userId })),
                project: { managerId: t.project.managerId },
              })),
            );
          }

          let rows = storeRef.store.tasks;
          if (where.columnId) {
            rows = rows.filter((t) => t.columnId === where.columnId);
          }
          if (where.id?.not) {
            rows = rows.filter((t) => t.id !== where.id!.not);
          }
          return Promise.resolve(rows.map((t) => ({ id: t.id })));
        },
      ),
      findFirst: jest.fn(
        ({
          where,
          select,
        }: {
          where: { id?: string; organizationId?: string };
          select?: Record<string, unknown>;
        }) => {
          if (!where.id) return Promise.resolve(null);
          const raw = buildRawTask(where.id);
          if (!raw) return Promise.resolve(null);
          if (
            where.organizationId &&
            raw.organizationId !== where.organizationId
          ) {
            return Promise.resolve(null);
          }

          const assigneeRows = storeRef.store.taskAssignees
            .filter((a) => a.taskId === raw.id)
            .map((a) => ({
              userId: a.userId,
              user: { id: a.userId, name: 'User', email: 'user@example.com' },
            }));

          const assigneeSelect = (
            select as {
              assignees?: { select?: { userId?: boolean; user?: unknown } };
            }
          )?.assignees?.select;
          if (assigneeSelect?.userId && !assigneeSelect.user) {
            return Promise.resolve({
              id: raw.id,
              projectId: raw.projectId,
              columnId: raw.columnId,
              position: raw.position,
              title: raw.title,
              project: raw.project,
              assignees: assigneeRows.map((a) => ({ userId: a.userId })),
            });
          }

          return Promise.resolve({
            ...raw,
            assignees: assigneeRows.map((a) => ({ user: a.user })),
          });
        },
      ),
      findFirstOrThrow: jest.fn(({ where }: { where: { id: string } }) => {
        const raw = buildRawTask(where.id);
        if (!raw) throw new Error('missing task');
        return Promise.resolve(raw);
      }),
      aggregate: jest.fn().mockResolvedValue({ _max: { position: 0 } }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { position?: number; columnId?: string };
        }) => {
          const row = storeRef.store.tasks.find((t) => t.id === where.id);
          if (!row) throw new Error('missing');
          if (data.columnId) row.columnId = data.columnId;
          if (data.position !== undefined) row.position = data.position;
          return Promise.resolve(row);
        },
      ),
    },
    taskAssignee: {
      findUnique: jest.fn(
        ({
          where: { taskId_userId },
        }: {
          where: { taskId_userId: { taskId: string; userId: string } };
        }) => {
          const row = storeRef.store.taskAssignees.find(
            (a) =>
              a.taskId === taskId_userId.taskId &&
              a.userId === taskId_userId.userId,
          );
          return Promise.resolve(row ? { id: 'ta' } : null);
        },
      ),
      create: jest.fn(
        ({ data }: { data: { taskId: string; userId: string } }) => {
          storeRef.store.taskAssignees.push(data);
          return Promise.resolve(data);
        },
      ),
    },
    comment: {
      create: jest.fn(
        ({
          data,
        }: {
          data: { taskId: string; authorId: string; body: string };
          select: unknown;
        }) => {
          const row = {
            id: `c-${++commentSeq}`,
            taskId: data.taskId,
            authorId: data.authorId,
            body: data.body,
            createdAt: new Date(),
            author: { id: data.authorId, name: 'Author' },
          };
          storeRef.store.comments.push(row);
          return Promise.resolve(row);
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    commentMention: {
      createMany: jest.fn(
        ({ data }: { data: Array<{ commentId: string; userId: string }> }) => {
          for (const row of data) {
            storeRef.store.commentMentions.push({
              id: `m-${row.userId}`,
              ...row,
            });
          }
          return Promise.resolve({ count: data.length });
        },
      ),
      findMany: jest.fn(({ where }: { where: { commentId: string } }) =>
        Promise.resolve(
          storeRef.store.commentMentions
            .filter((m) => m.commentId === where.commentId)
            .map((m) => ({
              userId: m.userId,
              user: { name: 'User' },
            })),
        ),
      ),
    },
    activityLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        storeRef.store.activityLogs.push({
          id: `act-${storeRef.store.activityLogs.length}`,
          ...data,
        });
        return Promise.resolve(data);
      }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };

  return prisma;
}

describe('Phase 7 Notifications (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let storeRef: { store: Store };
  let gateway: { emitToUser: jest.Mock };
  let deadlineScanner: DeadlineScanner;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
    storeRef = { store: createStore() };
    gateway = { emitToUser: jest.fn() };
    const prisma = createPrisma(storeRef);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({}),
        PassportModule,
      ],
      controllers: [
        NotificationsController,
        TasksController,
        CommentsController,
        ProjectsController,
      ],
      providers: [
        JwtStrategy,
        NotificationsService,
        TasksService,
        CommentsService,
        ProjectsService,
        DeadlineScanner,
        { provide: NotificationsGateway, useValue: gateway },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ColumnsService,
          useValue: { seedDefaultColumns: jest.fn() },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: MustResetGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    deadlineScanner = moduleFixture.get(DeadlineScanner);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    gateway.emitToUser.mockClear();
  });

  async function cookie(
    role: Role,
    userId: string,
    organizationId = ORG,
  ): Promise<string> {
    const token = await jwtService.signAsync(
      { sub: userId, role, organizationId },
      { secret: TEST_ACCESS_SECRET },
    );
    return `access_token=${token}`;
  }

  it('GET /notifications returns only the caller rows; unread filter works', async () => {
    const resA = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_A)])
      .expect(200);

    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].id).toBe('n-a-1');

    const unreadA = await request(app.getHttpServer())
      .get('/notifications?unread=true')
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_A)])
      .expect(200);
    expect(unreadA.body).toHaveLength(1);

    const resB = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_B)])
      .expect(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].id).toBe('n-b-1');
  });

  it('PATCH /notifications/:id/read marks own row; foreign id returns 404', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/n-a-1/read')
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_A)])
      .expect(204);

    expect(
      storeRef.store.notifications.find((n) => n.id === 'n-a-1')?.isRead,
    ).toBe(true);

    await request(app.getHttpServer())
      .patch('/notifications/n-a-1/read')
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_B)])
      .expect(404);
  });

  it('POST /notifications/read-all flips only caller unread rows', async () => {
    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_A)])
      .expect(204);

    expect(
      storeRef.store.notifications.filter(
        (n) => n.recipientId === USER_A && !n.isRead,
      ),
    ).toHaveLength(0);
    expect(
      storeRef.store.notifications.find((n) => n.recipientId === USER_B)
        ?.isRead,
    ).toBe(true);
  });

  it('assigning a task notifies the assignee and skips self-assign', async () => {
    const before = storeRef.store.notifications.length;

    await request(app.getHttpServer())
      .post(`/tasks/${TASK_ID}/assignees`)
      .set('Cookie', [await cookie(Role.PROJECT_MANAGER, PM_USER)])
      .send({ userId: USER_B })
      .expect(201);

    const created = storeRef.store.notifications.filter(
      (n) =>
        n.type === NotificationType.TASK_ASSIGNED && n.recipientId === USER_B,
    );
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(gateway.emitToUser).toHaveBeenCalled();
    expect(created.length).toBe(storeRef.store.notifications.length - before);

    gateway.emitToUser.mockClear();
    const countBeforeSelf = storeRef.store.notifications.length;
    await request(app.getHttpServer())
      .post(`/tasks/${TASK_ID}/assignees`)
      .set('Cookie', [await cookie(Role.PROJECT_MANAGER, PM_USER)])
      .send({ userId: USER_A })
      .expect(201);
    expect(storeRef.store.notifications.length).toBe(countBeforeSelf);
  });

  it('moving a task notifies assignees and PM but not the actor', async () => {
    gateway.emitToUser.mockClear();

    await request(app.getHttpServer())
      .patch(`/tasks/${TASK_ID}/move`)
      .set('Cookie', [await cookie(Role.PROJECT_MANAGER, PM_USER)])
      .send({ columnId: COL_REVIEW, position: 0 })
      .expect(200);

    const statusRows = storeRef.store.notifications.filter(
      (n) => n.type === NotificationType.STATUS_CHANGED,
    );
    expect(statusRows.some((n) => n.recipientId === USER_A)).toBe(true);
    expect(statusRows.some((n) => n.recipientId === PM_USER)).toBe(false);
    expect(gateway.emitToUser).toHaveBeenCalled();
  });

  it('comment mention creates MENTION notification for mentioned user', async () => {
    await request(app.getHttpServer())
      .post(`/tasks/${TASK_ID}/comments`)
      .set('Cookie', [await cookie(Role.COLLABORATOR, USER_A)])
      .send({ body: '@user-b', mentionedUserIds: [USER_B] })
      .expect(201);

    expect(
      storeRef.store.notifications.some(
        (n) => n.type === NotificationType.MENTION && n.recipientId === USER_B,
      ),
    ).toBe(true);
  });

  it('project transfer notifies the new manager', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${PROJECT_ID}/transfer`)
      .set('Cookie', [await cookie(Role.PROJECT_MANAGER, PM_USER)])
      .send({ newManagerId: USER_B })
      .expect(200);

    expect(
      storeRef.store.notifications.some(
        (n) =>
          n.type === NotificationType.PROJECT_TRANSFERRED &&
          n.recipientId === USER_B,
      ),
    ).toBe(true);
  });

  it('deadline scanner skips completed, notifies review assignees, PM when unassigned, dedupes', async () => {
    storeRef.store.tasks[0].columnId = COL_DONE;
    await deadlineScanner.scan();
    const afterCompleted = storeRef.store.notifications.filter(
      (n) => n.type === NotificationType.DEADLINE,
    ).length;

    storeRef.store.tasks[0].columnId = COL_REVIEW;
    await deadlineScanner.scan();
    const afterReview = storeRef.store.notifications.filter(
      (n) => n.type === NotificationType.DEADLINE,
    ).length;
    expect(afterReview).toBeGreaterThan(afterCompleted);

    storeRef.store.taskAssignees = [];
    storeRef.store.tasks[0].dueDate = new Date(Date.now() - 60 * 60 * 1000);
    await deadlineScanner.scan();
    expect(
      storeRef.store.notifications.some(
        (n) =>
          n.type === NotificationType.DEADLINE &&
          n.recipientId === PM_USER &&
          n.payload.kind === 'overdue',
      ),
    ).toBe(true);

    const count = storeRef.store.notifications.filter(
      (n) => n.type === NotificationType.DEADLINE,
    ).length;
    await deadlineScanner.scan();
    expect(
      storeRef.store.notifications.filter(
        (n) => n.type === NotificationType.DEADLINE,
      ).length,
    ).toBe(count);
  });
});
