import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommentsService } from './comments.service';
import { TasksService } from './tasks.service';

type MockPrisma = {
  project: { findFirst: jest.Mock };
  projectMember: { findUnique: jest.Mock };
  task: { findFirst: jest.Mock };
  comment: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  commentMention: {
    createMany: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
  };
  activityLog: { create: jest.Mock };
  notification: { create: jest.Mock };
  $transaction: jest.Mock;
};

const member: CurrentUserPayload = {
  userId: 'member-1',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

const otherMember: CurrentUserPayload = {
  userId: 'member-2',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

const pm: CurrentUserPayload = {
  userId: 'pm-1',
  role: Role.PROJECT_MANAGER,
  organizationId: 'org-1',
};

const owner: CurrentUserPayload = {
  userId: 'owner-1',
  role: Role.OWNER,
  organizationId: 'org-1',
};

const admin: CurrentUserPayload = {
  userId: 'admin-1',
  role: Role.ADMIN,
  organizationId: 'org-1',
};

function taskRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    projectId: 'project-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    status: ProjectStatus.ACTIVE,
    managerId: 'pm-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('CommentsService', () => {
  let prisma: MockPrisma;
  let tasksService: TasksService;
  let service: CommentsService;

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      task: { findFirst: jest.fn() },
      comment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      commentMention: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      activityLog: { create: jest.fn() },
      notification: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    const notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    tasksService = new TasksService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
    service = new CommentsService(
      prisma as unknown as PrismaService,
      tasksService,
      notificationsService as unknown as NotificationsService,
    );
  });

  function mockMemberAccess(userId = member.userId) {
    prisma.task.findFirst.mockResolvedValue(taskRecord());
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    prisma.projectMember.findUnique.mockResolvedValue({ id: 'membership-1' });
    if (userId === pm.userId) {
      prisma.projectMember.findUnique.mockResolvedValue(null);
    }
  }

  describe('listComments', () => {
    it('allows a project member to list comments', async () => {
      mockMemberAccess();
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'comment-1',
          taskId: 'task-1',
          body: 'Hello',
          createdAt: new Date('2026-01-01'),
          author: { id: 'member-1', name: 'Member One' },
          mentions: [],
        },
      ]);

      const result = await service.listComments(member, 'task-1');
      expect(result).toHaveLength(1);
      expect(prisma.comment.findMany).toHaveBeenCalled();
    });

    it('throws NotFound for ADMIN (read gate)', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(
        service.listComments(admin, 'task-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound for non-member Collaborator', async () => {
      prisma.task.findFirst.mockResolvedValue(taskRecord());
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.listComments(otherMember, 'task-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createComment', () => {
    it('allows a member to create a comment and writes COMMENT_ADDED', async () => {
      mockMemberAccess();
      prisma.comment.create.mockResolvedValue({
        id: 'comment-1',
        taskId: 'task-1',
        body: 'Hello',
        createdAt: new Date('2026-01-01'),
        author: { id: 'member-1', name: 'Member One' },
      });
      prisma.commentMention.findMany.mockResolvedValue([]);

      const result = await service.createComment(member, 'task-1', {
        body: 'Hello',
      });

      expect(result.id).toBe('comment-1');
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            type: ActivityType.COMMENT_ADDED,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata: expect.objectContaining({ commentId: 'comment-1' }),
          }),
        }),
      );
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('rejects mention of a non-member', async () => {
      mockMemberAccess();
      prisma.projectMember.findUnique
        .mockResolvedValueOnce({ id: 'm-1' })
        .mockResolvedValueOnce({ id: 'm-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.createComment(member, 'task-1', {
          body: 'Hey @outsider',
          mentionedUserIds: ['outsider-1'],
        }),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
    });
  });

  describe('deleteComment', () => {
    it('allows author to delete own comment', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });
      prisma.commentMention.deleteMany.mockResolvedValue({ count: 0 });
      prisma.comment.delete.mockResolvedValue({});

      await expect(
        service.deleteComment(member, 'comment-1'),
      ).resolves.toBeUndefined();
      expect(prisma.commentMention.deleteMany).toHaveBeenCalled();
      expect(prisma.comment.delete).toHaveBeenCalled();
    });

    it('forbids another plain member from deleting', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });

      await expect(
        service.deleteComment(otherMember, 'comment-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows owning PM to delete another user comment', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });
      prisma.commentMention.deleteMany.mockResolvedValue({ count: 0 });
      prisma.comment.delete.mockResolvedValue({});

      await expect(
        service.deleteComment(pm, 'comment-1'),
      ).resolves.toBeUndefined();
    });

    it('allows Owner to delete another user comment', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });
      prisma.commentMention.deleteMany.mockResolvedValue({ count: 0 });
      prisma.comment.delete.mockResolvedValue({});

      await expect(
        service.deleteComment(owner, 'comment-1'),
      ).resolves.toBeUndefined();
    });
  });
});
