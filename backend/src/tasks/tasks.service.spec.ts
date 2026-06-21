import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  NotificationType,
  Priority,
  ProjectStatus,
  Role,
} from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

// ─── Mock types ──────────────────────────────────────────────────────────────

type MockPrisma = {
  project: {
    findFirst: jest.Mock;
  };
  projectMember: {
    findUnique: jest.Mock;
  };
  column: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  task: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    aggregate: jest.Mock;
  };
  taskAssignee: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  taskLabel: { deleteMany: jest.Mock };
  checklistItem: { deleteMany: jest.Mock };
  activityLog: {
    create: jest.Mock;
    createMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  comment: {
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  commentMention: { deleteMany: jest.Mock };
  attachment: { deleteMany: jest.Mock };
  $transaction: jest.Mock;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date('2026-06-16T00:00:00.000Z');

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
const collaboratorNonMember: CurrentUserPayload = {
  userId: 'collab-2',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    status: ProjectStatus.ACTIVE,
    managerId: 'pm-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function rawTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    projectId: 'project-1',
    columnId: 'col-todo',
    title: 'My task',
    description: null,
    priority: Priority.MEDIUM,
    dueDate: null,
    position: 0,
    createdById: 'pm-1',
    createdAt: now,
    updatedAt: now,
    assignees: [],
    labels: [],
    _count: { checklist: 0 },
    checklist: [],
    project: {
      status: ProjectStatus.ACTIVE,
      managerId: 'pm-1',
      organizationId: 'org-1',
    },
    ...overrides,
  };
}

function todoColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-todo',
    name: 'To Do',
    position: 0,
    isCompletedColumn: false,
    isPmGated: false,
    ...overrides,
  };
}

function completedColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-done',
    name: 'Completed',
    position: 3,
    isCompletedColumn: true,
    isPmGated: true,
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('TasksService', () => {
  let prisma: MockPrisma;
  let service: TasksService;
  let notificationsService: { notify: jest.Mock; notifyMany: jest.Mock };

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      column: { findMany: jest.fn(), findFirst: jest.fn() },
      task: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      taskAssignee: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      taskLabel: { deleteMany: jest.fn() },
      checklistItem: { deleteMany: jest.fn() },
      activityLog: {
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      comment: { findMany: jest.fn(), deleteMany: jest.fn() },
      commentMention: { deleteMany: jest.fn() },
      attachment: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };

    // Default $transaction passes-through callback
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    service = new TasksService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  // ─── listTasks / getTask ────────────────────────────────────────────────────

  describe('listTasks', () => {
    it('returns tasks for a project member', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      prisma.task.findMany.mockResolvedValue([rawTask()]);

      const result = await service.listTasks(collaborator, 'project-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('throws 404 for ADMIN', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      await expect(
        service.listTasks(admin, 'project-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 for non-member Collaborator', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(
        service.listTasks(collaboratorNonMember, 'project-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 for cross-tenant (project not found)', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(
        service.listTasks(collaborator, 'other-project'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getTask', () => {
    it('returns task for owning PM', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      const result = await service.getTask(pm, 'task-1');
      expect(result.id).toBe('task-1');
    });

    it('throws 404 for ADMIN', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      await expect(service.getTask(admin, 'task-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 404 for non-member Collaborator', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(
        service.getTask(collaboratorNonMember, 'task-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 for cross-tenant task', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.getTask(pm, 'task-999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── createTask ─────────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('creates task and places it in the first column', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.column.findFirst.mockResolvedValue(todoColumn());
      prisma.task.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.task.create.mockResolvedValue(rawTask());
      prisma.activityLog.createMany.mockResolvedValue({ count: 0 });

      const result = await service.createTask(pm, 'project-1', {
        title: 'New task',
      });
      expect(result.id).toBe('task-1');
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            columnId: 'col-todo',
            position: 0,
            priority: Priority.MEDIUM,
          }),
        }),
      );
    });

    it('throws 409 NOT_A_MEMBER if assigneeId is not a project member', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.column.findFirst.mockResolvedValue(todoColumn());
      prisma.task.aggregate.mockResolvedValue({ _max: { position: 0 } });
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.createTask(pm, 'project-1', {
          title: 'Task',
          assigneeIds: ['unknown-user'],
        }),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
    });

    it('throws 409 PROJECT_ARCHIVED for archived project', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectRecord({ status: ProjectStatus.ARCHIVED }),
      );
      await expect(
        service.createTask(pm, 'project-1', { title: 'Task' }),
      ).rejects.toMatchObject({ response: { code: 'PROJECT_ARCHIVED' } });
    });
  });

  // ─── updateTask ─────────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('allows owning PM to update restricted fields and logs FIELD_CHANGED', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      const updated = rawTask({ title: 'Updated' });
      prisma.task.update.mockResolvedValue(updated);
      prisma.activityLog.createMany.mockResolvedValue({ count: 1 });

      const result = await service.updateTask(pm, 'task-1', {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
      expect(prisma.activityLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.arrayContaining([
            expect.objectContaining({
              type: ActivityType.FIELD_CHANGED,
              metadata: { field: 'title' },
            }),
          ]),
        }),
      );
    });

    it('throws 404 for a Collaborator (not managed project)', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(
        service.updateTask(collaborator, 'task-1', { title: 'Hack' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 404 for other PM (not owning)', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(
        service.updateTask(otherPm, 'task-1', { title: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── deleteTask ──────────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('allows owning PM to delete a task', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.deleteMany.mockResolvedValue({ count: 0 });
      prisma.commentMention.deleteMany.mockResolvedValue({ count: 0 });
      prisma.attachment.deleteMany.mockResolvedValue({ count: 0 });
      prisma.activityLog.deleteMany.mockResolvedValue({ count: 0 });
      prisma.checklistItem.deleteMany.mockResolvedValue({ count: 0 });
      prisma.taskLabel.deleteMany.mockResolvedValue({ count: 0 });
      prisma.taskAssignee.deleteMany.mockResolvedValue({ count: 0 });
      prisma.task.delete.mockResolvedValue({});

      await expect(service.deleteTask(pm, 'task-1')).resolves.toBeUndefined();
      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
    });

    it('throws 404 when another PM tries to delete', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(
        service.deleteTask(otherPm, 'task-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── moveTask ────────────────────────────────────────────────────────────────

  describe('moveTask', () => {
    it('allows owning PM to move task into gated Completed column', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask({ assignees: [] }));
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      // source col (non-gated), target col (gated)
      prisma.column.findFirst
        .mockResolvedValueOnce(completedColumn()) // target
        .mockResolvedValueOnce(todoColumn()); // source
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.update.mockResolvedValue({});
      prisma.activityLog.create.mockResolvedValue({});
      prisma.task.findFirstOrThrow.mockResolvedValue(
        rawTask({ columnId: 'col-done' }),
      );

      const result = await service.moveTask(pm, 'task-1', {
        columnId: 'col-done',
        position: 0,
      });
      expect(result.columnId).toBe('col-done');
    });

    it('throws PM_GATED when Collaborator-assignee tries to move into Completed', async () => {
      prisma.task.findFirst.mockResolvedValue(
        rawTask({ assignees: [{ userId: 'collab-1' }] }),
      );
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      prisma.column.findFirst
        .mockResolvedValueOnce(completedColumn()) // target gated
        .mockResolvedValueOnce(todoColumn()); // source non-gated

      await expect(
        service.moveTask(collaborator, 'task-1', {
          columnId: 'col-done',
          position: 0,
        }),
      ).rejects.toMatchObject({ response: { code: 'PM_GATED' } });
    });

    it('allows Collaborator-assignee to move between non-gated columns', async () => {
      const inProgress = { id: 'col-inprogress', isPmGated: false };
      prisma.task.findFirst.mockResolvedValue(
        rawTask({ assignees: [{ userId: 'collab-1' }] }),
      );
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      prisma.column.findFirst
        .mockResolvedValueOnce(inProgress) // target non-gated
        .mockResolvedValueOnce(todoColumn()); // source non-gated
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.update.mockResolvedValue({});
      prisma.activityLog.create.mockResolvedValue({});
      prisma.task.findFirstOrThrow.mockResolvedValue(
        rawTask({ columnId: 'col-inprogress' }),
      );

      const result = await service.moveTask(collaborator, 'task-1', {
        columnId: 'col-inprogress',
        position: 0,
      });
      expect(result.columnId).toBe('col-inprogress');
    });

    it('throws NOT_ASSIGNEE when non-assignee Collaborator tries to move', async () => {
      prisma.task.findFirst.mockResolvedValue(
        rawTask({ assignees: [] }), // no assignees
      );
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      const inProgress = { id: 'col-inprogress', isPmGated: false };
      prisma.column.findFirst
        .mockResolvedValueOnce(inProgress)
        .mockResolvedValueOnce(todoColumn());

      await expect(
        service.moveTask(collaborator, 'task-1', {
          columnId: 'col-inprogress',
          position: 0,
        }),
      ).rejects.toMatchObject({ response: { code: 'NOT_ASSIGNEE' } });
    });
  });

  // ─── addAssignee ────────────────────────────────────────────────────────────

  describe('addAssignee', () => {
    it('adds assignee and logs ASSIGNED', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce(rawTask()) // findTaskForManagement
        .mockResolvedValueOnce(
          rawTask({
            assignees: [
              { user: { id: 'collab-1', name: 'C', email: 'c@x.com' } },
            ],
          }),
        ); // getTask
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      prisma.taskAssignee.findUnique.mockResolvedValue(null);
      prisma.taskAssignee.create.mockResolvedValue({});
      prisma.activityLog.create.mockResolvedValue({});

      await service.addAssignee(pm, 'task-1', { userId: 'collab-1' });
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'collab-1',
          type: NotificationType.TASK_ASSIGNED,
        }),
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            type: ActivityType.ASSIGNED,
            metadata: { userId: 'collab-1' },
          }),
        }),
      );
    });

    it('throws 409 NOT_A_MEMBER when user is not a project member', async () => {
      prisma.task.findFirst.mockResolvedValue(rawTask());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.addAssignee(pm, 'task-1', { userId: 'stranger' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
    });
  });
});
