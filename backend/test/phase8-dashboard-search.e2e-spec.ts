/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Priority, ProjectStatus, Role, UserStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { MustResetGuard } from '../src/common/guards/must-reset.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { SearchController } from '../src/search/search.controller';
import { SearchService } from '../src/search/search.service';

const TEST_ACCESS_SECRET = 'test-access-secret';
const ORG_A = 'org-a';
const ORG_B = 'org-b';

const USER_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_PM = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_COLLAB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const PROJ_MEMBER = '11111111-1111-4111-8111-111111111111';
const PROJ_SECRET = '22222222-2222-4222-8222-222222222222';
const PROJ_ORG_B = '33333333-3333-4333-8333-333333333333';

const TASK_MEMBER = '44444444-4444-4444-8444-444444444444';
const TASK_SECRET = '55555555-5555-4555-8555-555555555555';
const TASK_ORG_B = '66666666-6666-4666-8666-666666666666';
const TASK_ASSIGNED = '77777777-7777-4777-8777-777777777777';
const TASK_OTHER = '88888888-8888-4888-8888-888888888888';

const COL_TODO = '99999999-9999-4999-8999-999999999991';
const COL_DONE = '99999999-9999-4999-8999-999999999992';

type Store = {
  users: Array<{
    id: string;
    organizationId: string;
    name: string;
    role: Role;
    status: UserStatus;
    mustResetPassword: boolean;
    createdAt: Date;
  }>;
  projects: Array<{
    id: string;
    organizationId: string;
    name: string;
    color: string;
    status: ProjectStatus;
    managerId: string;
  }>;
  projectMembers: Array<{ projectId: string; userId: string }>;
  columns: Array<{
    id: string;
    projectId: string;
    name: string;
    isCompletedColumn: boolean;
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
    createdAt: Date;
    updatedAt: Date;
  }>;
  taskAssignees: Array<{ taskId: string; userId: string }>;
};

function createStore(): Store {
  const now = new Date('2026-06-20T12:00:00.000Z');
  return {
    users: [
      {
        id: USER_OWNER,
        organizationId: ORG_A,
        name: 'Owner A',
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        mustResetPassword: false,
        createdAt: now,
      },
      {
        id: USER_ADMIN,
        organizationId: ORG_A,
        name: 'Admin A',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        mustResetPassword: false,
        createdAt: now,
      },
      {
        id: USER_PM,
        organizationId: ORG_A,
        name: 'PM A',
        role: Role.PROJECT_MANAGER,
        status: UserStatus.ACTIVE,
        mustResetPassword: false,
        createdAt: now,
      },
      {
        id: USER_COLLAB,
        organizationId: ORG_A,
        name: 'Collab A',
        role: Role.COLLABORATOR,
        status: UserStatus.ACTIVE,
        mustResetPassword: false,
        createdAt: now,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        organizationId: ORG_B,
        name: 'Owner B',
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        mustResetPassword: false,
        createdAt: now,
      },
    ],
    projects: [
      {
        id: PROJ_MEMBER,
        organizationId: ORG_A,
        name: 'Member Project',
        color: '#6366F1',
        status: ProjectStatus.ACTIVE,
        managerId: USER_PM,
      },
      {
        id: PROJ_SECRET,
        organizationId: ORG_A,
        name: 'Secret Project',
        color: '#6366F1',
        status: ProjectStatus.ACTIVE,
        managerId: USER_PM,
      },
      {
        id: PROJ_ORG_B,
        organizationId: ORG_B,
        name: 'Org B Project',
        color: '#6366F1',
        status: ProjectStatus.ACTIVE,
        managerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      },
    ],
    projectMembers: [{ projectId: PROJ_MEMBER, userId: USER_COLLAB }],
    columns: [
      {
        id: COL_TODO,
        projectId: PROJ_MEMBER,
        name: 'To Do',
        isCompletedColumn: false,
      },
      {
        id: COL_DONE,
        projectId: PROJ_MEMBER,
        name: 'Completed',
        isCompletedColumn: true,
      },
      {
        id: 'col-secret',
        projectId: PROJ_SECRET,
        name: 'To Do',
        isCompletedColumn: false,
      },
      {
        id: 'col-org-b',
        projectId: PROJ_ORG_B,
        name: 'To Do',
        isCompletedColumn: false,
      },
    ],
    tasks: [
      {
        id: TASK_MEMBER,
        organizationId: ORG_A,
        projectId: PROJ_MEMBER,
        columnId: COL_TODO,
        title: 'Build widget panel',
        description: 'Member-only widget task',
        priority: Priority.MEDIUM,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: TASK_SECRET,
        organizationId: ORG_A,
        projectId: PROJ_SECRET,
        columnId: 'col-secret',
        title: 'Hidden widget task',
        description: 'Should not appear for collab',
        priority: Priority.MEDIUM,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: TASK_ORG_B,
        organizationId: ORG_B,
        projectId: PROJ_ORG_B,
        columnId: 'col-org-b',
        title: 'Cross-tenant widget',
        description: null,
        priority: Priority.MEDIUM,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: TASK_ASSIGNED,
        organizationId: ORG_A,
        projectId: PROJ_MEMBER,
        columnId: COL_TODO,
        title: 'Assigned to collab',
        description: null,
        priority: Priority.HIGH,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: TASK_OTHER,
        organizationId: ORG_A,
        projectId: PROJ_MEMBER,
        columnId: COL_TODO,
        title: 'Assigned to PM only',
        description: null,
        priority: Priority.LOW,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    taskAssignees: [
      { taskId: TASK_ASSIGNED, userId: USER_COLLAB },
      { taskId: TASK_OTHER, userId: USER_PM },
    ],
  };
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function isMember(store: Store, projectId: string, userId: string): boolean {
  return store.projectMembers.some(
    (m) => m.projectId === projectId && m.userId === userId,
  );
}

function projectMatchesWhere(
  store: Store,
  projectId: string,
  where: Record<string, unknown>,
  callerUserId?: string,
): boolean {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) return false;

  if (where.id === '__none__') return false;

  if (
    typeof where.organizationId === 'string' &&
    project.organizationId !== where.organizationId
  ) {
    return false;
  }

  if (where.status && project.status !== (where.status as ProjectStatus)) {
    return false;
  }

  if (typeof where.managerId === 'string') {
    return project.managerId === where.managerId;
  }

  const membersClause = where.members as
    | { some?: { userId?: string } }
    | undefined;
  if (membersClause?.some?.userId) {
    return isMember(store, projectId, membersClause.some.userId);
  }

  const orClauses = where.OR as Array<Record<string, unknown>> | undefined;
  if (orClauses) {
    return orClauses.some((clause) =>
      projectMatchesWhere(store, projectId, clause, callerUserId),
    );
  }

  return true;
}

function taskMatchesWhere(
  store: Store,
  task: Store['tasks'][number],
  where: Record<string, unknown>,
): boolean {
  if (
    typeof where.organizationId === 'string' &&
    task.organizationId !== where.organizationId
  ) {
    return false;
  }

  const projectWhere = where.project as Record<string, unknown> | undefined;
  if (
    projectWhere &&
    !projectMatchesWhere(store, task.projectId, projectWhere)
  ) {
    return false;
  }

  const assigneesWhere = where.assignees as
    | { some?: { userId?: string } }
    | undefined;
  if (assigneesWhere?.some?.userId) {
    const assigned = store.taskAssignees.some(
      (a) => a.taskId === task.id && a.userId === assigneesWhere.some!.userId,
    );
    if (!assigned) return false;
  }

  const orWhere = where.OR as
    | Array<{
        title?: { contains: string; mode?: string };
        description?: { contains: string; mode?: string };
      }>
    | undefined;
  if (orWhere) {
    const matches = orWhere.some((clause) => {
      if (clause.title?.contains) {
        return includesInsensitive(task.title, clause.title.contains);
      }
      if (clause.description?.contains) {
        return includesInsensitive(
          task.description ?? '',
          clause.description.contains,
        );
      }
      return false;
    });
    if (!matches) return false;
  }

  const projectIdIn = where.projectId as { in?: string[] } | undefined;
  if (projectIdIn?.in && !projectIdIn.in.includes(task.projectId)) {
    return false;
  }

  const columnWhere = where.column as
    | { isCompletedColumn?: boolean }
    | undefined;
  if (columnWhere?.isCompletedColumn !== undefined) {
    const column = store.columns.find((c) => c.id === task.columnId);
    if (column?.isCompletedColumn !== columnWhere.isCompletedColumn) {
      return false;
    }
  }

  return true;
}

function createPrisma(storeRef: { store: Store }) {
  const prisma = {
    user: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { id: string };
          select?: { mustResetPassword?: true };
        }) => {
          const row = storeRef.store.users.find((u) => u.id === where.id);
          if (!row) return Promise.resolve(null);
          return Promise.resolve({ mustResetPassword: row.mustResetPassword });
        },
      ),
      groupBy: jest.fn(
        ({ where }: { by: ['role']; where: { organizationId: string } }) => {
          const counts = new Map<Role, number>();
          for (const user of storeRef.store.users) {
            if (user.organizationId !== where.organizationId) continue;
            counts.set(user.role, (counts.get(user.role) ?? 0) + 1);
          }
          return Promise.resolve(
            [...counts.entries()].map(([role, count]) => ({
              role,
              _count: { id: count },
            })),
          );
        },
      ),
      count: jest.fn(
        ({
          where,
        }: {
          where: { organizationId: string; status?: UserStatus };
        }) => {
          const count = storeRef.store.users.filter((u) => {
            if (u.organizationId !== where.organizationId) return false;
            if (where.status && u.status !== where.status) return false;
            return true;
          }).length;
          return Promise.resolve(count);
        },
      ),
      findMany: jest.fn(
        ({
          where,
          orderBy,
          take,
        }: {
          where: { organizationId: string };
          orderBy?: { createdAt: 'desc' };
          take?: number;
        }) => {
          let rows = storeRef.store.users.filter(
            (u) => u.organizationId === where.organizationId,
          );
          if (orderBy?.createdAt === 'desc') {
            rows = [...rows].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
          }
          if (take) rows = rows.slice(0, take);
          return Promise.resolve(
            rows.map((u) => ({
              id: u.id,
              name: u.name,
              role: u.role,
              status: u.status,
              createdAt: u.createdAt,
            })),
          );
        },
      ),
    },
    project: {
      findMany: jest.fn(
        ({
          where,
          orderBy,
        }: {
          where: Record<string, unknown>;
          orderBy?: { name: 'asc' };
        }) => {
          let rows = storeRef.store.projects.filter((p) =>
            projectMatchesWhere(storeRef.store, p.id, where),
          );
          if (orderBy?.name === 'asc') {
            rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
          }
          return Promise.resolve(
            rows.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
            })),
          );
        },
      ),
      count: jest.fn(
        ({
          where,
        }: {
          where: { organizationId: string; status?: ProjectStatus };
        }) => {
          const count = storeRef.store.projects.filter((p) => {
            if (p.organizationId !== where.organizationId) return false;
            if (where.status && p.status !== where.status) return false;
            return true;
          }).length;
          return Promise.resolve(count);
        },
      ),
    },
    task: {
      findMany: jest.fn(
        ({
          where,
          orderBy,
          take,
        }: {
          where: Record<string, unknown>;
          orderBy?:
            | { updatedAt: 'desc' }
            | Array<
                | { dueDate: { sort: 'asc'; nulls: 'last' } }
                | { createdAt: 'asc' }
              >;
          take?: number;
        }) => {
          let rows = storeRef.store.tasks.filter((t) =>
            taskMatchesWhere(storeRef.store, t, where),
          );

          if (
            orderBy &&
            !Array.isArray(orderBy) &&
            orderBy.updatedAt === 'desc'
          ) {
            rows = [...rows].sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
            );
          }

          if (Array.isArray(orderBy)) {
            rows = [...rows].sort((a, b) => {
              const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
              const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
              if (aDue !== bDue) return aDue - bDue;
              return a.createdAt.getTime() - b.createdAt.getTime();
            });
          }

          if (take) rows = rows.slice(0, take);

          return Promise.resolve(
            rows.map((t) => {
              const project = storeRef.store.projects.find(
                (p) => p.id === t.projectId,
              )!;
              const column = storeRef.store.columns.find(
                (c) => c.id === t.columnId,
              )!;
              return {
                id: t.id,
                title: t.title,
                projectId: t.projectId,
                priority: t.priority,
                dueDate: t.dueDate,
                project: { name: project.name },
                column: {
                  name: column.name,
                  isCompletedColumn: column.isCompletedColumn,
                },
              };
            }),
          );
        },
      ),
      groupBy: jest.fn(
        ({ where }: { by: ['projectId']; where: Record<string, unknown> }) => {
          const counts = new Map<string, number>();
          for (const task of storeRef.store.tasks) {
            if (!taskMatchesWhere(storeRef.store, task, where)) continue;
            counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
          }
          return Promise.resolve(
            [...counts.entries()].map(([projectId, count]) => ({
              projectId,
              _count: { id: count },
            })),
          );
        },
      ),
    },
  };

  return prisma;
}

describe('Phase 8 Dashboard & Search (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
    const storeRef = { store: createStore() };
    const prisma = createPrisma(storeRef);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({}),
        PassportModule,
      ],
      controllers: [SearchController, DashboardController],
      providers: [
        JwtStrategy,
        SearchService,
        DashboardService,
        { provide: PrismaService, useValue: prisma },
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function cookie(
    role: Role,
    userId: string,
    organizationId = ORG_A,
  ): Promise<string> {
    const token = await jwtService.signAsync(
      { sub: userId, role, organizationId },
      { secret: TEST_ACCESS_SECRET },
    );
    return `access_token=${token}`;
  }

  describe('Search scoping', () => {
    it('returns [] for empty q', async () => {
      const res = await request(app.getHttpServer())
        .get('/search?q=')
        .set('Cookie', [await cookie(Role.COLLABORATOR, USER_COLLAB)])
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns [] for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/search?q=widget')
        .set('Cookie', [await cookie(Role.ADMIN, USER_ADMIN)])
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('excludes tasks from non-member projects for Collaborator', async () => {
      const res = await request(app.getHttpServer())
        .get('/search?q=widget')
        .set('Cookie', [await cookie(Role.COLLABORATOR, USER_COLLAB)])
        .expect(200);

      const ids = (res.body as Array<{ taskId: string }>).map(
        (row) => row.taskId,
      );
      expect(ids).toContain(TASK_MEMBER);
      expect(ids).not.toContain(TASK_SECRET);
      expect(ids).not.toContain(TASK_ORG_B);
    });

    it('includes member-project matches for Collaborator', async () => {
      const res = await request(app.getHttpServer())
        .get('/search?q=Build')
        .set('Cookie', [await cookie(Role.COLLABORATOR, USER_COLLAB)])
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].taskId).toBe(TASK_MEMBER);
    });

    it('never returns cross-tenant matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/search?q=widget')
        .set('Cookie', [await cookie(Role.OWNER, USER_OWNER, ORG_A)])
        .expect(200);

      const ids = (res.body as Array<{ taskId: string }>).map(
        (row) => row.taskId,
      );
      expect(ids).not.toContain(TASK_ORG_B);
    });
  });

  describe('Dashboard role gating', () => {
    it('GET /dashboard/org-overview — OWNER/ADMIN 200; PM/COLLABORATOR 403', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/org-overview')
        .set('Cookie', [await cookie(Role.OWNER, USER_OWNER)])
        .expect(200);

      await request(app.getHttpServer())
        .get('/dashboard/org-overview')
        .set('Cookie', [await cookie(Role.ADMIN, USER_ADMIN)])
        .expect(200);

      await request(app.getHttpServer())
        .get('/dashboard/org-overview')
        .set('Cookie', [await cookie(Role.PROJECT_MANAGER, USER_PM)])
        .expect(403);

      await request(app.getHttpServer())
        .get('/dashboard/org-overview')
        .set('Cookie', [await cookie(Role.COLLABORATOR, USER_COLLAB)])
        .expect(403);
    });

    it('GET /dashboard/my-work — OWNER/PM/COLLABORATOR 200; ADMIN 403', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/my-work')
        .set('Cookie', [await cookie(Role.OWNER, USER_OWNER)])
        .expect(200);

      await request(app.getHttpServer())
        .get('/dashboard/my-work')
        .set('Cookie', [await cookie(Role.PROJECT_MANAGER, USER_PM)])
        .expect(200);

      await request(app.getHttpServer())
        .get('/dashboard/my-work')
        .set('Cookie', [await cookie(Role.COLLABORATOR, USER_COLLAB)])
        .expect(200);

      await request(app.getHttpServer())
        .get('/dashboard/my-work')
        .set('Cookie', [await cookie(Role.ADMIN, USER_ADMIN)])
        .expect(403);
    });

    it('my-work returns only the caller assigned tasks', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/my-work')
        .set('Cookie', [await cookie(Role.COLLABORATOR, USER_COLLAB)])
        .expect(200);

      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].id).toBe(TASK_ASSIGNED);
    });

    it('org-overview counts are org-scoped', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/org-overview')
        .set('Cookie', [await cookie(Role.OWNER, USER_OWNER)])
        .expect(200);

      expect(res.body.projectCount).toBe(2);
      expect(res.body.userCounts.OWNER).toBe(1);
      expect(res.body.userCounts.COLLABORATOR).toBe(1);
      expect(
        (res.body.recentUsers as Array<{ id: string }>).every((u) =>
          storeUsersInOrgA(u.id),
        ),
      ).toBe(true);
    });
  });
});

function storeUsersInOrgA(userId: string): boolean {
  return [USER_OWNER, USER_ADMIN, USER_PM, USER_COLLAB].includes(userId);
}
