import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectStatus, Role } from '@prisma/client';
import { ColumnsService } from '../columns/columns.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

type MockPrisma = {
  project: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  projectMember: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

const createdAt = new Date('2026-06-16T00:00:00.000Z');

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    organizationId: 'org-1',
    name: 'Website Redesign',
    description: null,
    color: '#6366F1',
    status: ProjectStatus.ACTIVE,
    managerId: 'pm-1',
    createdAt,
    updatedAt: createdAt,
    _count: { members: 2 },
    ...overrides,
  };
}

const owner: CurrentUserPayload = {
  userId: 'owner-1',
  role: Role.OWNER,
  organizationId: 'org-1',
};
const pm: CurrentUserPayload = {
  userId: 'pm-1',
  role: Role.PROJECT_MANAGER,
  organizationId: 'org-1',
};
const otherPm: CurrentUserPayload = {
  userId: 'pm-2',
  role: Role.PROJECT_MANAGER,
  organizationId: 'org-1',
};
const admin: CurrentUserPayload = {
  userId: 'admin-1',
  role: Role.ADMIN,
  organizationId: 'org-1',
};
const collaborator: CurrentUserPayload = {
  userId: 'collab-1',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

describe('ProjectsService', () => {
  let prisma: MockPrisma;
  let columns: { seedDefaultColumns: jest.Mock };
  let service: ProjectsService;

  beforeEach(() => {
    prisma = {
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    columns = { seedDefaultColumns: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      columns as unknown as ColumnsService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('creates a project, seeds 4 columns, and adds the manager as a member', async () => {
    prisma.project.create.mockResolvedValue({ id: 'project-1' });
    prisma.project.findUniqueOrThrow.mockResolvedValue(projectRecord());

    const result = await service.createProject(pm, {
      name: 'Website Redesign',
      color: '#6366F1',
    });

    expect(result).toMatchObject({ id: 'project-1', memberCount: 2 });

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          organizationId: 'org-1',
          managerId: 'pm-1',
          status: ProjectStatus.ACTIVE,
          members: { create: { userId: 'pm-1' } },
        }),
      }),
    );
    expect(columns.seedDefaultColumns).toHaveBeenCalledWith('project-1');
  });

  it('returns [] for ADMIN listing projects', async () => {
    await expect(service.listProjects(admin)).resolves.toEqual([]);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('throws 404 when an ADMIN reads a project', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    await expect(service.getProject(admin, 'project-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 404 when a PM reads another PM project', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(
      service.getProject(otherPm, 'project-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a member COLLABORATOR read a project', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'member-1' });
    await expect(
      service.getProject(collaborator, 'project-1'),
    ).resolves.toMatchObject({ id: 'project-1' });
  });

  it('throws 404 when a non-member COLLABORATOR reads a project', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(
      service.getProject(collaborator, 'project-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the OWNER read any project in the org', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    await expect(service.getProject(owner, 'project-1')).resolves.toMatchObject(
      { id: 'project-1' },
    );
  });

  it('archives a project owned by the PM', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.project.update.mockResolvedValue(projectRecord());
    await expect(
      service.archiveProject(pm, 'project-1'),
    ).resolves.toBeUndefined();
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: ProjectStatus.ARCHIVED },
    });
  });

  it('throws 404 when another PM archives a project', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    await expect(
      service.archiveProject(otherPm, 'project-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects updates to an archived project', async () => {
    prisma.project.findFirst.mockResolvedValue(
      projectRecord({ status: ProjectStatus.ARCHIVED }),
    );
    await expect(
      service.updateProject(pm, 'project-1', { name: 'New name' }),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_ARCHIVED' },
    });
  });

  it('transfers a project to a valid PM', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.user.findFirst.mockResolvedValue({ id: 'pm-2' });
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        projectMember: { upsert: jest.fn() },
        project: {
          update: jest
            .fn()
            .mockResolvedValue(projectRecord({ managerId: 'pm-2' })),
        },
      }),
    );

    const result = await service.transferProject(pm, 'project-1', {
      newManagerId: 'pm-2',
    });
    expect(result).toMatchObject({ managerId: 'pm-2' });
  });

  it('rejects transfer to a non-PM/Owner', async () => {
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.transferProject(pm, 'project-1', { newManagerId: 'collab-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
