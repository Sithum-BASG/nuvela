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
import { MembersController } from '../src/projects/members.controller';
import { MembersService } from '../src/projects/members.service';
import { OrganizationsController } from '../src/organizations/organizations.controller';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

const TEST_ACCESS_SECRET = 'test-access-secret';

// Phase 4 RBAC matrix: confirms every Phase 4 endpoint carries the correct
// @Roles() guard. Feature services are mocked (no DB) so this isolates the
// role-guard wiring — the per-service specs cover the ownership/404 logic.
describe('Phase 4 RBAC matrix (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  // Each mocked service method resolves a trivial value; we only assert the
  // HTTP status the guards produce (200/201 when allowed, 403 when not).
  const usersService = {
    listUsers: jest.fn().mockResolvedValue([]),
    createUser: jest.fn().mockResolvedValue({}),
    updateUser: jest.fn().mockResolvedValue({}),
    deactivateUser: jest.fn().mockResolvedValue({ done: true }),
    resendInvite: jest.fn().mockResolvedValue(undefined),
  };
  const organizationsService = {
    renameOrg: jest.fn().mockResolvedValue({ id: 'o', name: 'n' }),
    addAdmin: jest.fn().mockResolvedValue({}),
    removeAdmin: jest.fn().mockResolvedValue(undefined),
  };
  const projectsService = {
    listProjects: jest.fn().mockResolvedValue([]),
    listArchivedProjects: jest.fn().mockResolvedValue([]),
    getProject: jest.fn().mockResolvedValue({}),
    createProject: jest.fn().mockResolvedValue({}),
    updateProject: jest.fn().mockResolvedValue({}),
    archiveProject: jest.fn().mockResolvedValue(undefined),
    unarchiveProject: jest.fn().mockResolvedValue(undefined),
    transferProject: jest.fn().mockResolvedValue({}),
  };
  const membersService = {
    listMembers: jest.fn().mockResolvedValue([]),
    listInviteCandidates: jest.fn().mockResolvedValue([]),
    addMember: jest.fn().mockResolvedValue({}),
    removeMember: jest.fn().mockResolvedValue({ assignedTasks: [] }),
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
      controllers: [
        UsersController,
        OrganizationsController,
        ProjectsController,
        MembersController,
      ],
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        { provide: OrganizationsService, useValue: organizationsService },
        { provide: ProjectsService, useValue: projectsService },
        { provide: MembersService, useValue: membersService },
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
      {
        sub: `${role.toLowerCase()}-user`,
        role,
        organizationId: 'org-a',
      },
      { secret: TEST_ACCESS_SECRET },
    );
    return `access_token=${token}`;
  }

  // Helper: GET/POST/PATCH/DELETE with a role cookie, returns the status.
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

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer()).get('/projects').expect(401);
  });

  it('GET /users — ADMIN/OWNER allowed, PM/COLLABORATOR forbidden', async () => {
    expect(await status('get', '/users', Role.ADMIN)).toBe(200);
    expect(await status('get', '/users', Role.OWNER)).toBe(200);
    expect(await status('get', '/users', Role.PROJECT_MANAGER)).toBe(403);
    expect(await status('get', '/users', Role.COLLABORATOR)).toBe(403);
  });

  it('POST /users — ADMIN/OWNER allowed, PM/COLLABORATOR forbidden', async () => {
    const body = {
      name: 'Sam',
      email: 'sam@example.com',
      role: Role.COLLABORATOR,
    };
    expect(await status('post', '/users', Role.ADMIN, body)).toBe(201);
    expect(await status('post', '/users', Role.PROJECT_MANAGER, body)).toBe(
      403,
    );
    expect(await status('post', '/users', Role.COLLABORATOR, body)).toBe(403);
  });

  it('POST /users/:id/deactivate — ADMIN/OWNER allowed, PM forbidden', async () => {
    expect(await status('post', '/users/u1/deactivate', Role.ADMIN)).toBe(200);
    expect(
      await status('post', '/users/u1/deactivate', Role.PROJECT_MANAGER),
    ).toBe(403);
  });

  it('PATCH /organization — OWNER only', async () => {
    const body = { name: 'New Org' };
    expect(await status('patch', '/organization', Role.OWNER, body)).toBe(200);
    expect(await status('patch', '/organization', Role.ADMIN, body)).toBe(403);
    expect(
      await status('patch', '/organization', Role.PROJECT_MANAGER, body),
    ).toBe(403);
  });

  it('POST /organization/admins — OWNER only', async () => {
    const body = { userId: '11111111-1111-4111-8111-111111111111' };
    expect(await status('post', '/organization/admins', Role.OWNER, body)).toBe(
      201,
    );
    expect(await status('post', '/organization/admins', Role.ADMIN, body)).toBe(
      403,
    );
  });

  it('GET /projects — all authenticated roles allowed (service filters)', async () => {
    expect(await status('get', '/projects', Role.OWNER)).toBe(200);
    expect(await status('get', '/projects', Role.ADMIN)).toBe(200);
    expect(await status('get', '/projects', Role.PROJECT_MANAGER)).toBe(200);
    expect(await status('get', '/projects', Role.COLLABORATOR)).toBe(200);
  });

  it('POST /projects — PM/OWNER allowed, ADMIN/COLLABORATOR forbidden', async () => {
    const body = { name: 'P', color: '#fff' };
    expect(await status('post', '/projects', Role.PROJECT_MANAGER, body)).toBe(
      201,
    );
    expect(await status('post', '/projects', Role.OWNER, body)).toBe(201);
    expect(await status('post', '/projects', Role.ADMIN, body)).toBe(403);
    expect(await status('post', '/projects', Role.COLLABORATOR, body)).toBe(
      403,
    );
  });

  it('POST /projects/:id/transfer — PM/OWNER allowed, COLLABORATOR forbidden', async () => {
    const body = { newManagerId: '11111111-1111-4111-8111-111111111111' };
    expect(
      await status('post', '/projects/p1/transfer', Role.PROJECT_MANAGER, body),
    ).toBe(200);
    expect(
      await status('post', '/projects/p1/transfer', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('POST /projects/:id/members — PM/OWNER allowed, COLLABORATOR forbidden', async () => {
    const body = { userId: '11111111-1111-4111-8111-111111111111' };
    expect(
      await status('post', '/projects/p1/members', Role.PROJECT_MANAGER, body),
    ).toBe(201);
    expect(
      await status('post', '/projects/p1/members', Role.COLLABORATOR, body),
    ).toBe(403);
  });

  it('GET /projects/:id/members — any authenticated role reaches the service', async () => {
    // The guard admits all roles; the service enforces membership/404.
    expect(await status('get', '/projects/p1/members', Role.COLLABORATOR)).toBe(
      200,
    );
  });
});
