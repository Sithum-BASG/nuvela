import { Injectable } from '@nestjs/common';
import { ProjectStatus, Role, UserStatus, type Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AssistantContext, AssistantPageContext } from './assistant.types';

type RecentUserRow = {
  name: string;
  role: Role;
  status: UserStatus;
};

type TaskContextRow = {
  title: string;
  priority: string;
  dueDate: Date | null;
  project: { name: string };
  column: { name: string };
  assignees: { user: { name: string } }[];
  labels: { label: { name: string } }[];
  _count: { comments: number; attachments: number };
};

type FocusedTaskRow = {
  title: string;
  priority: string;
  dueDate: Date | null;
  project: { name: string };
  column: { name: string };
};

@Injectable()
export class AssistantContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    caller: CurrentUserPayload,
    page?: AssistantPageContext,
  ): Promise<AssistantContext> {
    if (caller.role === Role.ADMIN) {
      return this.buildAdminContext(caller, page);
    }

    return this.buildProjectContext(caller, page);
  }

  private async buildAdminContext(
    caller: CurrentUserPayload,
    page?: AssistantPageContext,
  ): Promise<AssistantContext> {
    const [userCount, pendingInviteCount, recentUsers] = await Promise.all([
      this.prisma.user.count({
        where: { organizationId: caller.organizationId },
      }),
      this.prisma.user.count({
        where: {
          organizationId: caller.organizationId,
          status: UserStatus.PENDING,
        },
      }),
      this.prisma.user.findMany({
        where: { organizationId: caller.organizationId },
        select: {
          name: true,
          role: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return this.context(caller, page, [
      'Admin context is limited to user and organization management.',
      'Do not include project or task content for Admin users.',
      `Org users: ${userCount}.`,
      `Pending invites: ${pendingInviteCount}.`,
      `Recent users: ${this.formatRecentUsers(recentUsers)}.`,
    ]);
  }

  private async buildProjectContext(
    caller: CurrentUserPayload,
    page?: AssistantPageContext,
  ): Promise<AssistantContext> {
    const [tasks, focusedTask] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          organizationId: caller.organizationId,
          project: this.accessibleProjectWhere(caller),
        },
        select: this.taskContextSelect(),
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
        take: 25,
      }),
      page?.taskId ? this.findFocusedTask(caller, page.taskId) : null,
    ]);

    const lines = [
      'Project context includes only accessible active task metadata.',
      'Attachment contents are not available; only attachment counts may be mentioned.',
    ];

    if (page?.taskId) {
      lines.push(
        focusedTask ? this.formatFocusedTask(focusedTask) : 'No focused task.',
      );
    }

    lines.push(this.formatTaskSnapshot(tasks));

    return this.context(caller, page, lines);
  }

  private findFocusedTask(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<FocusedTaskRow | null> {
    return this.prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId: caller.organizationId,
        project: this.accessibleProjectWhere(caller),
      },
      select: {
        title: true,
        priority: true,
        dueDate: true,
        project: { select: { name: true } },
        column: { select: { name: true } },
      },
    });
  }

  private accessibleProjectWhere(
    caller: CurrentUserPayload,
  ): Prisma.ProjectWhereInput {
    const base: Prisma.ProjectWhereInput = {
      organizationId: caller.organizationId,
      status: ProjectStatus.ACTIVE,
    };

    if (caller.role === Role.OWNER) {
      return base;
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      return {
        ...base,
        OR: [
          { managerId: caller.userId },
          { members: { some: { userId: caller.userId } } },
        ],
      };
    }

    return {
      ...base,
      members: { some: { userId: caller.userId } },
    };
  }

  private taskContextSelect() {
    return {
      title: true,
      priority: true,
      dueDate: true,
      project: { select: { name: true } },
      column: { select: { name: true } },
      assignees: { select: { user: { select: { name: true } } } },
      labels: { select: { label: { select: { name: true } } } },
      _count: { select: { comments: true, attachments: true } },
    };
  }

  private context(
    caller: CurrentUserPayload,
    page: AssistantPageContext | undefined,
    summaryLines: string[],
  ): AssistantContext {
    return {
      user: {
        userId: caller.userId,
        role: caller.role,
        organizationId: caller.organizationId,
      },
      ...(page ? { page } : {}),
      summary: summaryLines.join('\n'),
    };
  }

  private formatRecentUsers(users: RecentUserRow[]): string {
    if (users.length === 0) {
      return 'none';
    }

    return users
      .map((user) => `${user.name} (${user.role}, ${user.status})`)
      .join('; ');
  }

  private formatFocusedTask(task: FocusedTaskRow): string {
    return `Focused task: ${task.title} in ${task.project.name}, ${task.column.name}, ${task.priority}, due ${this.formatDate(task.dueDate)}.`;
  }

  private formatTaskSnapshot(tasks: TaskContextRow[]): string {
    if (tasks.length === 0) {
      return 'Task snapshot: no accessible active tasks.';
    }

    const taskLines = tasks.map((task) => {
      const assignees = task.assignees.map((row) => row.user.name).join(', ');
      const labels = task.labels.map((row) => row.label.name).join(', ');

      return [
        `${task.title} in ${task.project.name}`,
        `column ${task.column.name}`,
        `priority ${task.priority}`,
        `due ${this.formatDate(task.dueDate)}`,
        `assignees ${assignees || 'none'}`,
        `labels ${labels || 'none'}`,
        `${task._count.comments} comments`,
        `${task._count.attachments} attachments`,
      ].join('; ');
    });

    return `Task snapshot:\n${taskLines.join('\n')}`;
  }

  private formatDate(date: Date | null): string {
    return date ? date.toISOString().slice(0, 10) : 'none';
  }
}
