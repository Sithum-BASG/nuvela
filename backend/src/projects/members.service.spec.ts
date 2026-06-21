import { NotFoundException } from '@nestjs/common';
import { ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MembersService } from './members.service';

type MockPrisma = {
  project: { findFirst: jest.Mock };
  projectMember: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  user: { findFirst: jest.Mock; findMany: jest.Mock };
  task: { findMany: jest.Mock };
  taskAssignee: { deleteMany: jest.Mock; upsert: jest.Mock };
  $transaction: jest.Mock;
};

const createdAt = new Date('2026-06-16T00:00:00.000Z');

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

function projectAccess(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    managerId: 'pm-1',
    status: ProjectStatus.ACTIVE,
    ...overrides,
  };
}

describe('MembersService', () => {
  let prisma: MockPrisma;
  let service: MembersService;

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn() },
      projectMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      user: { findFirst: jest.fn(), findMany: jest.fn() },
      task: { findMany: jest.fn() },
      taskAssignee: { deleteMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new MembersService(prisma as unknown as PrismaService);
  });

  it('lists members for the owning PM', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findMany.mockResolvedValue([
      {
        userId: 'collab-1',
        createdAt,
        user: {
          name: 'Maya',
          email: 'maya@example.com',
          role: Role.COLLABORATOR,
        },
      },
    ]);

    await expect(service.listMembers(pm, 'project-1')).resolves.toEqual([
      {
        userId: 'collab-1',
        name: 'Maya',
        email: 'maya@example.com',
        role: Role.COLLABORATOR,
        addedAt: createdAt,
      },
    ]);
  });

  it('lets a member COLLABORATOR list members', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.projectMember.findMany.mockResolvedValue([]);
    await expect(
      service.listMembers(collaborator, 'project-1'),
    ).resolves.toEqual([]);
  });

  it('throws 404 when an ADMIN lists members', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    await expect(
      service.listMembers(admin, 'project-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds a member', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.user.findFirst.mockResolvedValue({
      id: 'collab-2',
      name: 'Sam',
      email: 'sam@example.com',
      role: Role.COLLABORATOR,
    });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    prisma.projectMember.create.mockResolvedValue({
      userId: 'collab-2',
      createdAt,
    });

    await expect(
      service.addMember(pm, 'project-1', 'collab-2'),
    ).resolves.toMatchObject({ userId: 'collab-2', name: 'Sam' });
  });

  it('rejects adding an existing member', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.user.findFirst.mockResolvedValue({
      id: 'collab-2',
      name: 'Sam',
      email: 'sam@example.com',
      role: Role.COLLABORATOR,
    });
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    await expect(
      service.addMember(pm, 'project-1', 'collab-2'),
    ).rejects.toMatchObject({ response: { code: 'ALREADY_MEMBER' } });
  });

  it('rejects a COLLABORATOR adding members (404)', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    await expect(
      service.addMember(collaborator, 'project-1', 'collab-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a member with no assigned tasks', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.projectMember.delete.mockResolvedValue({});

    await expect(
      service.removeMember(pm, 'project-1', 'collab-1', {}),
    ).resolves.toEqual({ assignedTasks: [] });
    expect(prisma.projectMember.delete).toHaveBeenCalled();
  });

  it('returns 409 with tasks when removing a member with unreassigned tasks', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.task.findMany.mockResolvedValue([{ id: 'task-1', title: 'Do it' }]);

    await expect(
      service.removeMember(pm, 'project-1', 'collab-1', {}),
    ).rejects.toMatchObject({
      response: { code: 'TASKS_NEED_REASSIGNMENT' },
    });
  });

  it('removes a member after applying reassignments', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findUnique
      .mockResolvedValueOnce({ id: 'm-1' }) // membership of removed user
      .mockResolvedValueOnce({ id: 'm-2' }); // new assignee is a member
    prisma.task.findMany.mockResolvedValue([{ id: 'task-1', title: 'Do it' }]);
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        taskAssignee: {
          deleteMany: jest.fn(),
          upsert: jest.fn(),
        },
        projectMember: { delete: jest.fn() },
      }),
    );

    await expect(
      service.removeMember(pm, 'project-1', 'collab-1', {
        reassignments: [{ taskId: 'task-1', newAssigneeId: 'collab-2' }],
      }),
    ).resolves.toEqual({ assignedTasks: [] });
  });

  it('removes a member and leaves reassigned tasks unassigned when newAssigneeId is null', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.task.findMany.mockResolvedValue([{ id: 'task-1', title: 'Do it' }]);
    const taskAssignee = {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        taskAssignee,
        projectMember: { delete: jest.fn() },
      }),
    );

    await expect(
      service.removeMember(pm, 'project-1', 'collab-1', {
        reassignments: [{ taskId: 'task-1', newAssigneeId: null }],
      }),
    ).resolves.toEqual({ assignedTasks: [] });
    expect(taskAssignee.deleteMany).toHaveBeenCalled();
    expect(taskAssignee.upsert).not.toHaveBeenCalled();
  });

  it('rejects removing the project manager', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    await expect(
      service.removeMember(pm, 'project-1', 'pm-1', {}),
    ).rejects.toMatchObject({ response: { code: 'CANNOT_REMOVE_MANAGER' } });
  });

  it('lets the OWNER manage members of any project', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.projectMember.delete.mockResolvedValue({});
    await expect(
      service.removeMember(owner, 'project-1', 'collab-1', {}),
    ).resolves.toEqual({ assignedTasks: [] });
  });

  it('lists invite candidates', async () => {
    prisma.project.findFirst.mockResolvedValue(projectAccess());
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'collab-2',
        name: 'Sam',
        email: 'sam@example.com',
        role: Role.COLLABORATOR,
      },
    ]);
    await expect(
      service.listInviteCandidates(pm, 'project-1', 'sam'),
    ).resolves.toHaveLength(1);
  });
});
