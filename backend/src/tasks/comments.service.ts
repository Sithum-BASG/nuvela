import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  NotificationType,
  ProjectStatus,
  Role,
} from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { TasksService } from './tasks.service';

export type CommentRow = {
  id: string;
  taskId: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string };
  mentions: { userId: string; name: string }[];
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listComments(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<CommentRow[]> {
    await this.loadTaskForRead(caller, taskId);

    const comments = await this.prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        taskId: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        mentions: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    return comments.map((comment) => ({
      id: comment.id,
      taskId: comment.taskId,
      body: comment.body,
      createdAt: comment.createdAt,
      author: comment.author,
      mentions: comment.mentions.map((mention) => ({
        userId: mention.userId,
        name: mention.user.name,
      })),
    }));
  }

  async createComment(
    caller: CurrentUserPayload,
    taskId: string,
    dto: CreateCommentDto,
  ): Promise<CommentRow> {
    const task = await this.loadTaskForRead(caller, taskId);
    const project = await this.tasksService.findAccessibleProject(
      caller,
      task.projectId,
    );
    this.assertNotArchived(project.status);

    const mentionedUserIds = [
      ...new Set(dto.mentionedUserIds ?? []),
    ] as string[];

    for (const userId of mentionedUserIds) {
      const membership = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: task.projectId, userId },
        },
        select: { id: true },
      });
      if (!membership) {
        throw new ConflictException({
          code: 'NOT_A_MEMBER',
          message: 'Mentioned user is not a member of this project.',
        });
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          taskId,
          authorId: caller.userId,
          body: dto.body,
        },
        select: {
          id: true,
          taskId: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      });

      if (mentionedUserIds.length > 0) {
        await tx.commentMention.createMany({
          data: mentionedUserIds.map((userId) => ({
            commentId: created.id,
            userId,
          })),
        });
      }

      await tx.activityLog.create({
        data: {
          taskId,
          actorId: caller.userId,
          type: ActivityType.COMMENT_ADDED,
          metadata: { commentId: created.id },
        },
      });

      return created;
    });

    if (mentionedUserIds.length > 0) {
      await this.notificationsService.notifyMany(
        caller.organizationId,
        mentionedUserIds,
        NotificationType.MENTION,
        {
          taskId,
          projectId: task.projectId,
          commentId: comment.id,
        },
        caller.userId,
      );
    }

    const mentions =
      mentionedUserIds.length > 0
        ? await this.prisma.commentMention.findMany({
            where: { commentId: comment.id },
            select: {
              userId: true,
              user: { select: { name: true } },
            },
          })
        : [];

    return {
      id: comment.id,
      taskId: comment.taskId,
      body: comment.body,
      createdAt: comment.createdAt,
      author: comment.author,
      mentions: mentions.map((mention) => ({
        userId: mention.userId,
        name: mention.user.name,
      })),
    };
  }

  async deleteComment(
    caller: CurrentUserPayload,
    commentId: string,
  ): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        task: { organizationId: caller.organizationId },
      },
      select: {
        id: true,
        authorId: true,
        task: {
          select: {
            project: { select: { managerId: true } },
          },
        },
      },
    });
    if (!comment) throw notFound();

    const isAuthor = comment.authorId === caller.userId;
    const isOwner = caller.role === Role.OWNER;
    const isOwningPm =
      caller.role === Role.PROJECT_MANAGER &&
      comment.task.project.managerId === caller.userId;

    if (!isAuthor && !isOwner && !isOwningPm) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You may only delete your own comments.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.commentMention.deleteMany({ where: { commentId } });
      await tx.comment.delete({ where: { id: commentId } });
    });
  }

  private async loadTaskForRead(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<{ id: string; projectId: string }> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: { id: true, projectId: true },
    });
    if (!task) throw notFound();

    await this.tasksService.findAccessibleProject(caller, task.projectId);
    return task;
  }

  private assertNotArchived(status: ProjectStatus): void {
    if (status === ProjectStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'PROJECT_ARCHIVED',
        message: 'Archived projects are read-only. Unarchive it first.',
      });
    }
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Resource was not found.',
  });
}
