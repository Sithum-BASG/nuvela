import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { MustResetGuard } from '../src/common/guards/must-reset.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ChecklistController } from '../src/tasks/checklist.controller';
import { ChecklistService } from '../src/tasks/checklist.service';
import { LabelsController } from '../src/tasks/labels.controller';
import { LabelsService } from '../src/tasks/labels.service';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_ACCESS_SECRET = 'test-access-secret';

// Phase 5 RBAC matrix: confirms every Phase 5 endpoint carries the correct
// @Roles() guard. All feature services are mocked (no DB) so this isolates
// the role-guard wiring — per-service specs cover ownership/404 logic.
describe('Phase 5 Tasks RBAC matrix (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const tasksService = {
    listColumns: jest.fn().mockResolvedValue([]),
    listTasks: jest.fn().mockResolvedValue([]),
    createTask: jest.fn().mockResolvedValue({}),
    getTask: jest.fn().mockResolvedValue({}),
    updateTask: jest.fn().mockResolvedValue({}),
    deleteTask: jest.fn().mockResolvedValue(undefined),
    moveTask: jest.fn().mockResolvedValue({}),
    addAssignee: jest.fn().mockResolvedValue({}),
    removeAssignee: jest.fn().mockResolvedValue(undefined),
  };

  const labelsService = {
    listLabels: jest.fn().mockResolvedValue([]),
    createLabel: jest.fn().mockResolvedValue({}),
    updateLabel: jest.fn().mockResolvedValue({}),
    deleteLabel: jest.fn().mockResolvedValue(undefined),
    applyLabel: jest.fn().mockResolvedValue(undefined),
    removeLabel: jest.fn().mockResolvedValue(undefined),
  };

  const checklistService = {
    addItem: jest.fn().mockResolvedValue({}),
    updateItem: jest.fn().mockResolvedValue({}),
    deleteItem: jest.fn().mockResolvedValue(undefined),
  };

  // MustResetGuard reads the user; undefined → not must-reset → passes.
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
      controllers: [TasksController, LabelsController, ChecklistController],
      providers: [
        JwtStrategy,
        { provide: TasksService, useValue: tasksService },
        { provide: LabelsService, useValue: labelsService },
        { provide: ChecklistService, useValue: checklistService },
        { provide: PrismaService, useValue: prismaMock },
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

  async function cookie(role: Role): Promise<string> {
    const token = await jwtService.signAsync(
      { sub: `${role.toLowerCase()}-user`, role, organizationId: 'org-a' },
      { secret: TEST_ACCESS_SECRET },
    );
    return `access_token=${token}`;
  }

  async function status(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    role: Role,
    body?: object,
  ): Promise<number> {
    const req = request(app.getHttpServer())
      [method](path)
      .set('Cookie', [await cookie(role)]);
    if (body) req.send(body);
    const res = await req;
    return res.status;
  }

  // ─── Auth guard ──────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .get('/projects/p1/columns')
      .expect(401);
    await request(app.getHttpServer())
      .get('/projects/p1/tasks')
      .expect(401);
    await request(app.getHttpServer())
      .get('/projects/p1/labels')
      .expect(401);
  });

  // ─── Columns ─────────────────────────────────────────────────────────────────

  it('GET /projects/:id/columns — any authenticated role allowed', async () => {
    expect(await status('get', '/projects/p1/columns', Role.OWNER)).toBe(200);
    expect(await status('get', '/projects/p1/columns', Role.ADMIN)).toBe(200);
    expect(
      await status('get', '/projects/p1/columns', Role.PROJECT_MANAGER),
    ).toBe(200);
    expect(
      await status('get', '/projects/p1/columns', Role.COLLABORATOR),
    ).toBe(200);
  });

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  it('GET /projects/:id/tasks — any authenticated role allowed', async () => {
    expect(await status('get', '/projects/p1/tasks', Role.OWNER)).toBe(200);
    expect(await status('get', '/projects/p1/tasks', Role.ADMIN)).toBe(200);
    expect(
      await status('get', '/projects/p1/tasks', Role.PROJECT_MANAGER),
    ).toBe(200);
    expect(
      await status('get', '/projects/p1/tasks', Role.COLLABORATOR),
    ).toBe(200);
  });

  it('POST /projects/:id/tasks — PM/Owner allowed, ADMIN/COLLABORATOR forbidden', async () => {
    const body = { title: 'New task', columnId: 'col-1' };
    expect(
      await status('post', '/projects/p1/tasks', Role.PROJECT_MANAGER, body),
    ).toBe(201);
    expect(
      await status('post', '/projects/p1/tasks', Role.OWNER, body),
    ).toBe(201);
    expect(
      await status('post', '/projects/p1/tasks', Role.ADMIN, body),
    ).toBe(403);
    expect(
      await status('post', '/projects/p1/tasks', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('GET /tasks/:id — any authenticated role allowed', async () => {
    expect(await status('get', '/tasks/t1', Role.OWNER)).toBe(200);
    expect(await status('get', '/tasks/t1', Role.PROJECT_MANAGER)).toBe(200);
    expect(await status('get', '/tasks/t1', Role.COLLABORATOR)).toBe(200);
  });

  it('PATCH /tasks/:id — PM/Owner allowed, ADMIN/COLLABORATOR forbidden', async () => {
    const body = { title: 'Updated' };
    expect(
      await status('patch', '/tasks/t1', Role.PROJECT_MANAGER, body),
    ).toBe(200);
    expect(await status('patch', '/tasks/t1', Role.OWNER, body)).toBe(200);
    expect(await status('patch', '/tasks/t1', Role.ADMIN, body)).toBe(403);
    expect(
      await status('patch', '/tasks/t1', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('DELETE /tasks/:id — PM/Owner allowed, ADMIN/COLLABORATOR forbidden', async () => {
    expect(
      await status('delete', '/tasks/t1', Role.PROJECT_MANAGER),
    ).toBe(204);
    expect(await status('delete', '/tasks/t1', Role.OWNER)).toBe(204);
    expect(await status('delete', '/tasks/t1', Role.ADMIN)).toBe(403);
    expect(await status('delete', '/tasks/t1', Role.COLLABORATOR)).toBe(403);
  });

  it('PATCH /tasks/:id/move — any authenticated role reaches the service', async () => {
    // No @Roles decorator; gating lives in the service layer.
    const body = { columnId: '22222222-2222-4222-8222-222222222222', position: 0 };
    expect(
      await status('patch', '/tasks/t1/move', Role.PROJECT_MANAGER, body),
    ).toBe(200);
    expect(
      await status('patch', '/tasks/t1/move', Role.COLLABORATOR, body),
    ).toBe(200);
  });

  // ─── Assignees ───────────────────────────────────────────────────────────────

  it('POST /tasks/:id/assignees — PM/Owner allowed, COLLABORATOR forbidden', async () => {
    const body = { userId: '11111111-1111-4111-8111-111111111111' };
    expect(
      await status('post', '/tasks/t1/assignees', Role.PROJECT_MANAGER, body),
    ).toBe(201);
    expect(
      await status('post', '/tasks/t1/assignees', Role.OWNER, body),
    ).toBe(201);
    expect(
      await status('post', '/tasks/t1/assignees', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('DELETE /tasks/:id/assignees/:userId — PM/Owner allowed, COLLABORATOR forbidden', async () => {
    expect(
      await status(
        'delete',
        '/tasks/t1/assignees/11111111-1111-4111-8111-111111111111',
        Role.PROJECT_MANAGER,
      ),
    ).toBe(204);
    expect(
      await status(
        'delete',
        '/tasks/t1/assignees/11111111-1111-4111-8111-111111111111',
        Role.COLLABORATOR,
      ),
    ).toBe(403);
  });

  // ─── Labels ──────────────────────────────────────────────────────────────────

  it('GET /projects/:id/labels — any authenticated role allowed', async () => {
    expect(
      await status('get', '/projects/p1/labels', Role.OWNER),
    ).toBe(200);
    expect(
      await status('get', '/projects/p1/labels', Role.PROJECT_MANAGER),
    ).toBe(200);
    expect(
      await status('get', '/projects/p1/labels', Role.COLLABORATOR),
    ).toBe(200);
  });

  it('POST /projects/:id/labels — PM/Owner allowed, ADMIN/COLLABORATOR forbidden', async () => {
    const body = { name: 'Bug', color: '#ff0000' };
    expect(
      await status('post', '/projects/p1/labels', Role.PROJECT_MANAGER, body),
    ).toBe(201);
    expect(
      await status('post', '/projects/p1/labels', Role.OWNER, body),
    ).toBe(201);
    expect(
      await status('post', '/projects/p1/labels', Role.ADMIN, body),
    ).toBe(403);
    expect(
      await status('post', '/projects/p1/labels', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('PATCH /labels/:id — PM/Owner allowed, ADMIN/COLLABORATOR forbidden', async () => {
    const body = { name: 'Updated' };
    expect(
      await status('patch', '/labels/l1', Role.PROJECT_MANAGER, body),
    ).toBe(200);
    expect(await status('patch', '/labels/l1', Role.OWNER, body)).toBe(200);
    expect(await status('patch', '/labels/l1', Role.ADMIN, body)).toBe(403);
    expect(
      await status('patch', '/labels/l1', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('DELETE /labels/:id — PM/Owner allowed, ADMIN/COLLABORATOR forbidden', async () => {
    expect(
      await status('delete', '/labels/l1', Role.PROJECT_MANAGER),
    ).toBe(204);
    expect(await status('delete', '/labels/l1', Role.OWNER)).toBe(204);
    expect(await status('delete', '/labels/l1', Role.ADMIN)).toBe(403);
    expect(await status('delete', '/labels/l1', Role.COLLABORATOR)).toBe(403);
  });

  it('POST /tasks/:taskId/labels — PM/Owner allowed, COLLABORATOR forbidden', async () => {
    const body = { labelId: '33333333-3333-4333-8333-333333333333' };
    expect(
      await status('post', '/tasks/t1/labels', Role.PROJECT_MANAGER, body),
    ).toBe(201);
    expect(
      await status('post', '/tasks/t1/labels', Role.OWNER, body),
    ).toBe(201);
    expect(
      await status('post', '/tasks/t1/labels', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('DELETE /tasks/:taskId/labels/:labelId — PM/Owner allowed, COLLABORATOR forbidden', async () => {
    expect(
      await status('delete', '/tasks/t1/labels/l1', Role.PROJECT_MANAGER),
    ).toBe(204);
    expect(
      await status('delete', '/tasks/t1/labels/l1', Role.OWNER),
    ).toBe(204);
    expect(
      await status('delete', '/tasks/t1/labels/l1', Role.COLLABORATOR),
    ).toBe(403);
  });

  // ─── Checklist ───────────────────────────────────────────────────────────────

  it('POST /tasks/:taskId/checklist — PM/Owner allowed, COLLABORATOR forbidden', async () => {
    const body = { text: 'Write tests' };
    expect(
      await status(
        'post',
        '/tasks/t1/checklist',
        Role.PROJECT_MANAGER,
        body,
      ),
    ).toBe(201);
    expect(
      await status('post', '/tasks/t1/checklist', Role.OWNER, body),
    ).toBe(201);
    expect(
      await status('post', '/tasks/t1/checklist', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('PATCH /checklist/:id — any authenticated role reaches the service', async () => {
    // No @Roles decorator; field-level gating (text vs isChecked) is in service.
    const body = { isChecked: true };
    expect(
      await status('patch', '/checklist/ci1', Role.PROJECT_MANAGER, body),
    ).toBe(200);
    expect(
      await status('patch', '/checklist/ci1', Role.COLLABORATOR, body),
    ).toBe(200);
  });

  it('DELETE /checklist/:id — PM/Owner allowed, COLLABORATOR forbidden', async () => {
    expect(
      await status('delete', '/checklist/ci1', Role.PROJECT_MANAGER),
    ).toBe(204);
    expect(await status('delete', '/checklist/ci1', Role.OWNER)).toBe(204);
    expect(
      await status('delete', '/checklist/ci1', Role.COLLABORATOR),
    ).toBe(403);
  });
});
