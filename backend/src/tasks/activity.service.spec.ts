import { NotFoundException } from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { TasksService } from './tasks.service';

const member: CurrentUserPayload = {
  userId: 'member-1',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

const admin: CurrentUserPayload = {
  userId: 'admin-1',
  role: Role.ADMIN,
  organizationId: 'org-1',
};

describe('ActivityService', () => {
  let prisma: {
    task: { findFirst: jest.Mock };
    project: { findFirst: jest.Mock };
    projectMember: { findUnique: jest.Mock };
    activityLog: { findMany: jest.Mock };
  };
  let service: ActivityService;

  beforeEach(() => {
    prisma = {
      task: { findFirst: jest.fn() },
      project: { findFirst: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      activityLog: { findMany: jest.fn() },
    };

    const tasksService = new TasksService(
      prisma as unknown as PrismaService,
      { notify: jest.fn(), notifyMany: jest.fn() } as never,
    );
    service = new ActivityService(
      prisma as unknown as PrismaService,
      tasksService,
    );
  });

  it('returns ordered rows for a project member', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
    });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.ACTIVE,
      managerId: 'pm-1',
    });
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.activityLog.findMany.mockResolvedValue([
      {
        id: 'a2',
        type: ActivityType.COMMENT_ADDED,
        metadata: { commentId: 'c1' },
        createdAt: new Date('2026-06-02'),
        actor: { id: 'member-1', name: 'Member' },
      },
      {
        id: 'a1',
        type: ActivityType.STATUS_CHANGED,
        metadata: null,
        createdAt: new Date('2026-06-01'),
        actor: { id: 'pm-1', name: 'PM' },
      },
    ]);

    const rows = await service.getActivity(member, 'task-1');
    expect(rows).toHaveLength(2);
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('throws NotFound for ADMIN', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
    });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.ACTIVE,
      managerId: 'pm-1',
    });

    await expect(service.getActivity(admin, 'task-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
