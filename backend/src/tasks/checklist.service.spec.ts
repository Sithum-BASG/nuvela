import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ChecklistService } from './checklist.service';

// ─── Mock types ──────────────────────────────────────────────────────────────

type MockPrisma = {
  task: { findFirst: jest.Mock };
  checklistItem: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    aggregate: jest.Mock;
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
const collaboratorAssignee: CurrentUserPayload = {
  userId: 'collab-1',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};
const collaboratorNonAssignee: CurrentUserPayload = {
  userId: 'collab-2',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

function taskRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    projectId: 'project-1',
    organizationId: 'org-1',
    project: { status: ProjectStatus.ACTIVE, managerId: 'pm-1' },
    assignees: [{ userId: 'collab-1' }],
    ...overrides,
  };
}

function itemRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    taskId: 'task-1',
    text: 'Write tests',
    isChecked: false,
    position: 0,
    task: {
      organizationId: 'org-1',
      projectId: 'project-1',
      project: { status: ProjectStatus.ACTIVE, managerId: 'pm-1' },
      assignees: [{ userId: 'collab-1' }],
    },
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('ChecklistService', () => {
  let prisma: MockPrisma;
  let service: ChecklistService;

  beforeEach(() => {
    prisma = {
      task: { findFirst: jest.fn() },
      checklistItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      activityLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    service = new ChecklistService(prisma as unknown as PrismaService);
  });

  // ─── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('allows PM to add a checklist item', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      prisma.checklistItem.aggregate.mockResolvedValue({
        _max: { position: null },
      });
      prisma.checklistItem.create.mockResolvedValue({
        id: 'item-1',
        text: 'Write tests',
        isChecked: false,
        position: 0,
      });

      const result = await service.addItem(pm, 'task-1', {
        text: 'Write tests',
      });
      expect(result.id).toBe('item-1');
      expect(prisma.checklistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ position: 0, isChecked: false }),
        }),
      );
    });

    it('throws Forbidden for Collaborator (not PM)', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      await expect(
        service.addItem(collaboratorAssignee, 'task-1', {
          text: 'Write tests',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── updateItem ─────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('allows assignee Collaborator to toggle isChecked and logs CHECKLIST_CHECKED', async () => {
      prisma.checklistItem.findFirst.mockResolvedValue(itemRecord());
      prisma.checklistItem.update.mockResolvedValue({
        id: 'item-1',
        text: 'Write tests',
        isChecked: true,
        position: 0,
      });
      prisma.activityLog.create.mockResolvedValue({});

      const result = await service.updateItem(collaboratorAssignee, 'item-1', {
        isChecked: true,
      });
      expect(result.isChecked).toBe(true);
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            type: ActivityType.CHECKLIST_CHECKED,
          }),
        }),
      );
    });

    it('throws NOT_ASSIGNEE when non-assignee Collaborator toggles isChecked', async () => {
      prisma.checklistItem.findFirst.mockResolvedValue(itemRecord());
      await expect(
        service.updateItem(collaboratorNonAssignee, 'item-1', {
          isChecked: true,
        }),
      ).rejects.toMatchObject({ response: { code: 'NOT_ASSIGNEE' } });
    });

    it('throws Forbidden when Collaborator tries to edit text', async () => {
      prisma.checklistItem.findFirst.mockResolvedValue(itemRecord());
      await expect(
        service.updateItem(collaboratorAssignee, 'item-1', { text: 'Hacked' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows PM to edit text', async () => {
      prisma.checklistItem.findFirst.mockResolvedValue(itemRecord());
      prisma.checklistItem.update.mockResolvedValue({
        id: 'item-1',
        text: 'Updated text',
        isChecked: false,
        position: 0,
      });
      prisma.activityLog.create.mockResolvedValue({});

      const result = await service.updateItem(pm, 'item-1', {
        text: 'Updated text',
      });
      expect(result.text).toBe('Updated text');
    });

    it('throws 404 for cross-tenant item', async () => {
      prisma.checklistItem.findFirst.mockResolvedValue(
        itemRecord({
          task: {
            organizationId: 'other-org',
            projectId: 'p1',
            project: { status: ProjectStatus.ACTIVE, managerId: 'pm-1' },
            assignees: [],
          },
        }),
      );
      await expect(
        service.updateItem(pm, 'item-1', { isChecked: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
