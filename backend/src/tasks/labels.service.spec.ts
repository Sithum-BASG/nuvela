import { ForbiddenException } from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';
import { LabelsService } from './labels.service';

// ─── Mock types ──────────────────────────────────────────────────────────────

type MockPrisma = {
  project: { findFirst: jest.Mock };
  projectMember: { findUnique: jest.Mock };
  label: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  taskLabel: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  task: {
    findFirst: jest.Mock;
  };
  activityLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const pm: CurrentUserPayload = {
  userId: 'pm-1',
  role: Role.PROJECT_MANAGER,
  organizationId: 'org-1',
};
const collaborator: CurrentUserPayload = {
  userId: 'collab-1',
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

function labelRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'label-1',
    name: 'Bug',
    color: '#FF0000',
    projectId: 'project-1',
    project: { status: ProjectStatus.ACTIVE, managerId: 'pm-1' },
    ...overrides,
  };
}

function taskRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    projectId: 'project-1',
    organizationId: 'org-1',
    project: { status: ProjectStatus.ACTIVE, managerId: 'pm-1' },
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('LabelsService', () => {
  let prisma: MockPrisma;
  let tasksService: TasksService;
  let service: LabelsService;

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      label: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      taskLabel: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      task: { findFirst: jest.fn() },
      activityLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    // TasksService is needed for findAccessibleProject in listLabels
    tasksService = new TasksService(
      prisma as unknown as PrismaService,
      { notify: jest.fn(), notifyMany: jest.fn() } as never,
    );
    service = new LabelsService(
      prisma as unknown as PrismaService,
      tasksService,
    );
  });

  // ─── createLabel ────────────────────────────────────────────────────────────

  describe('createLabel', () => {
    it('allows PM to create a label', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.label.create.mockResolvedValue({
        id: 'label-1',
        name: 'Bug',
        color: '#FF0000',
      });

      const result = await service.createLabel(pm, 'project-1', {
        name: 'Bug',
        color: '#FF0000',
      });
      expect(result.id).toBe('label-1');
      expect(prisma.label.create).toHaveBeenCalled();
    });

    it('throws Forbidden for Collaborator', async () => {
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      await expect(
        service.createLabel(collaborator, 'project-1', {
          name: 'Bug',
          color: '#FF0000',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── applyLabel ─────────────────────────────────────────────────────────────

  describe('applyLabel', () => {
    it('throws INVALID_LABEL when label belongs to another project', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      // Label not found for this project
      prisma.label.findFirst.mockResolvedValue(null);

      await expect(
        service.applyLabel(pm, 'task-1', { labelId: 'label-other' }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_LABEL' } });
    });

    it('allows PM to apply a valid label', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.label.findFirst.mockResolvedValue({ id: 'label-1' });
      prisma.taskLabel.findUnique.mockResolvedValue(null);
      prisma.taskLabel.create.mockResolvedValue({});
      prisma.activityLog.create.mockResolvedValue({});

      await expect(
        service.applyLabel(pm, 'task-1', { labelId: 'label-1' }),
      ).resolves.toBeUndefined();
      expect(prisma.taskLabel.create).toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            type: ActivityType.FIELD_CHANGED,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata: expect.objectContaining({ field: 'labels' }),
          }),
        }),
      );
    });

    it('throws Forbidden when Collaborator tries to apply a label', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(
        service.applyLabel(collaborator, 'task-1', { labelId: 'label-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── deleteLabel ────────────────────────────────────────────────────────────

  describe('deleteLabel', () => {
    it('deletes TaskLabel rows before the label', async () => {
      prisma.label.findFirst.mockResolvedValue(labelRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.taskLabel.deleteMany.mockResolvedValue({ count: 2 });
      prisma.label.delete.mockResolvedValue({});

      await service.deleteLabel(pm, 'label-1');
      expect(prisma.taskLabel.deleteMany).toHaveBeenCalledWith({
        where: { labelId: 'label-1' },
      });
      expect(prisma.label.delete).toHaveBeenCalledWith({
        where: { id: 'label-1' },
      });
    });

    it('throws 404 for Collaborator on deleteLabel', async () => {
      prisma.label.findFirst.mockResolvedValue(labelRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(
        service.deleteLabel(collaborator, 'label-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
