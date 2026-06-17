import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, Priority, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AddAssigneeDto } from './dto/add-assignee.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  isCompletedColumn: boolean;
  isPmGated: boolean;
};

export type AssigneeRow = {
  userId: string;
  name: string;
  email: string;
};

export type LabelRow = {
  id: string;
  name: string;
  color: string;
};

export type TaskRow = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: Date | null;
  position: number;
  assignees: AssigneeRow[];
  labels: LabelRow[];
  checklistTotal: number;
  checklistDone: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

const TASK_SELECT = {
  id: true,
  projectId: true,
  columnId: true,
  title: true,
  description: true,
  priority: true,
  dueDate: true,
  position: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  assignees: {
    select: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
  labels: {
    select: {
      label: { select: { id: true, name: true, color: true } },
    },
  },
  _count: {
    select: {
      checklist: true,
    },
  },
  checklist: {
    select: { isChecked: true },
  },
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Columns ──────────────────────────────────────────────────────────────

  async listColumns(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ColumnRow[]> {
    await this.findAccessibleProject(caller, projectId);
    const columns = await this.prisma.column.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        isCompletedColumn: true,
        isPmGated: true,
      },
    });
    return columns;
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  async listTasks(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<TaskRow[]> {
    await this.findAccessibleProject(caller, projectId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId, organizationId: caller.organizationId },
      orderBy: [{ columnId: 'asc' }, { position: 'asc' }],
      select: TASK_SELECT,
    });
    return tasks.map(toTaskRow);
  }

  async getTask(caller: CurrentUserPayload, taskId: string): Promise<TaskRow> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: { ...TASK_SELECT, projectId: true },
    });
    if (!task) throw notFound();
    // Enforce project read access (member/PM/Owner; ADMIN/non-member → 404)
    await this.findAccessibleProject(caller, task.projectId);
    return toTaskRow(task);
  }

  async createTask(
    caller: CurrentUserPayload,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<TaskRow> {
    const project = await this.findManagedProject(caller, projectId);
    this.assertNotArchived(project.status);

    // Always place into the first column (lowest position) — never trust client
    const firstColumn = await this.prisma.column.findFirst({
      where: { projectId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (!firstColumn) {
      throw new ConflictException({
        code: 'NO_COLUMNS',
        message: 'Project has no columns.',
      });
    }

    // position = max existing position in that column + 1
    const maxPos = await this.prisma.task.aggregate({
      where: { columnId: firstColumn.id },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    // Validate assigneeIds are all project members
    const assigneeIds = dto.assigneeIds ?? [];
    if (assigneeIds.length > 0) {
      await this.assertProjectMembers(projectId, assigneeIds);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: caller.organizationId,
          projectId,
          columnId: firstColumn.id,
          title: dto.title,
          description: dto.description ?? null,
          priority: dto.priority ?? Priority.MEDIUM,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          position,
          createdById: caller.userId,
          assignees: assigneeIds.length
            ? { create: assigneeIds.map((userId) => ({ userId })) }
            : undefined,
        },
        select: TASK_SELECT,
      });

      // ActivityLog ASSIGNED per initial assignee
      if (assigneeIds.length > 0) {
        await tx.activityLog.createMany({
          data: assigneeIds.map((userId) => ({
            taskId: task.id,
            actorId: caller.userId,
            type: ActivityType.ASSIGNED,
            metadata: { userId },
          })),
        });
      }

      return task;
    });

    return toTaskRow(created);
  }

  async updateTask(
    caller: CurrentUserPayload,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskRow> {
    const task = await this.findTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    const changedFields: string[] = [];
    if (dto.title !== undefined && dto.title !== task.title)
      changedFields.push('title');
    if (dto.description !== undefined && dto.description !== task.description)
      changedFields.push('description');
    if (dto.priority !== undefined && dto.priority !== task.priority)
      changedFields.push('priority');
    if (dto.dueDate !== undefined) {
      const incoming = dto.dueDate ? new Date(dto.dueDate).toISOString() : null;
      const existing = task.dueDate ? task.dueDate.toISOString() : null;
      if (incoming !== existing) changedFields.push('dueDate');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          }),
        },
        select: TASK_SELECT,
      });

      if (changedFields.length > 0) {
        await tx.activityLog.createMany({
          data: changedFields.map((field) => ({
            taskId,
            actorId: caller.userId,
            type: ActivityType.FIELD_CHANGED,
            metadata: { field },
          })),
        });
      }

      return t;
    });

    return toTaskRow(updated);
  }

  async deleteTask(caller: CurrentUserPayload, taskId: string): Promise<void> {
    const task = await this.findTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    await this.prisma.$transaction(async (tx) => {
      // Delete child rows before the task itself
      // CommentMentions before Comments
      const comments = await tx.comment.findMany({
        where: { taskId },
        select: { id: true },
      });
      if (comments.length > 0) {
        await tx.commentMention.deleteMany({
          where: { commentId: { in: comments.map((c) => c.id) } },
        });
      }
      await tx.comment.deleteMany({ where: { taskId } });
      await tx.attachment.deleteMany({ where: { taskId } });
      await tx.activityLog.deleteMany({ where: { taskId } });
      await tx.checklistItem.deleteMany({ where: { taskId } });
      await tx.taskLabel.deleteMany({ where: { taskId } });
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.task.delete({ where: { id: taskId } });
    });
  }

  async moveTask(
    caller: CurrentUserPayload,
    taskId: string,
    dto: MoveTaskDto,
  ): Promise<TaskRow> {
    // Load task + current column scoped to org
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: {
        id: true,
        projectId: true,
        columnId: true,
        position: true,
        project: {
          select: { status: true, managerId: true, organizationId: true },
        },
        assignees: { select: { userId: true } },
      },
    });
    if (!task) throw notFound();

    // Ensure caller has project read access (ADMIN/non-member → 404)
    await this.findAccessibleProject(caller, task.projectId);
    this.assertNotArchived(task.project.status);

    // Load target column — must belong to same project
    const targetColumn = await this.prisma.column.findFirst({
      where: { id: dto.columnId, projectId: task.projectId },
      select: { id: true, isPmGated: true },
    });
    if (!targetColumn) {
      throw new ConflictException({
        code: 'INVALID_COLUMN',
        message: 'Target column does not belong to this project.',
      });
    }

    // Load source column
    const sourceColumn = await this.prisma.column.findFirst({
      where: { id: task.columnId },
      select: { id: true, isPmGated: true },
    });
    if (!sourceColumn) throw notFound();

    const isPm =
      caller.role === Role.OWNER ||
      (caller.role === Role.PROJECT_MANAGER &&
        task.project.managerId === caller.userId);

    // PM-gating check
    if (sourceColumn.isPmGated || targetColumn.isPmGated) {
      if (!isPm) {
        throw new ForbiddenException({
          code: 'PM_GATED',
          message: 'Only the PM can move tasks into or out of Completed.',
        });
      }
    } else {
      // Non-gated move: PM/Owner OR an assignee of this task
      if (!isPm) {
        const isAssignee = task.assignees.some(
          (a) => a.userId === caller.userId,
        );
        if (!isAssignee) {
          throw new ForbiddenException({
            code: 'NOT_ASSIGNEE',
            message: 'You can only move tasks assigned to you.',
          });
        }
      }
    }

    const columnChanged = task.columnId !== dto.columnId;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (columnChanged) {
        // Reorder source column: remove the task, renumber 0..n-1
        const sourceTasks = await tx.task.findMany({
          where: { columnId: task.columnId, id: { not: taskId } },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        for (let i = 0; i < sourceTasks.length; i++) {
          await tx.task.update({
            where: { id: sourceTasks[i].id },
            data: { position: i },
          });
        }
      }

      // Reorder target column: insert task at dto.position, renumber 0..n-1
      const targetTasks = await tx.task.findMany({
        where: {
          columnId: dto.columnId,
          id: { not: taskId },
        },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      // Splice in the moving task
      targetTasks.splice(dto.position, 0, { id: taskId });
      for (let i = 0; i < targetTasks.length; i++) {
        await tx.task.update({
          where: { id: targetTasks[i].id },
          data: {
            position: i,
            ...(targetTasks[i].id === taskId ? { columnId: dto.columnId } : {}),
          },
        });
      }

      // ActivityLog STATUS_CHANGED if column changed
      if (columnChanged) {
        await tx.activityLog.create({
          data: {
            taskId,
            actorId: caller.userId,
            type: ActivityType.STATUS_CHANGED,
            metadata: { fromColumnId: task.columnId, toColumnId: dto.columnId },
          },
        });
      }

      return tx.task.findFirstOrThrow({
        where: { id: taskId },
        select: TASK_SELECT,
      });
    });

    return toTaskRow(updated);
  }

  async addAssignee(
    caller: CurrentUserPayload,
    taskId: string,
    dto: AddAssigneeDto,
  ): Promise<TaskRow> {
    const task = await this.findTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    // Validate assignee is a project member
    await this.assertProjectMembers(task.projectId, [dto.userId]);

    // Idempotent — check if already assigned
    const existing = await this.prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId: dto.userId } },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.taskAssignee.create({ data: { taskId, userId: dto.userId } });
        await tx.activityLog.create({
          data: {
            taskId,
            actorId: caller.userId,
            type: ActivityType.ASSIGNED,
            metadata: { userId: dto.userId },
          },
        });
      });
    }

    return this.getTask(caller, taskId);
  }

  async removeAssignee(
    caller: CurrentUserPayload,
    taskId: string,
    userId: string,
  ): Promise<void> {
    const task = await this.findTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    const existing = await this.prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.taskAssignee.delete({
          where: { taskId_userId: { taskId, userId } },
        });
        await tx.activityLog.create({
          data: {
            taskId,
            actorId: caller.userId,
            type: ActivityType.UNASSIGNED,
            metadata: { userId },
          },
        });
      });
    }
  }

  // ─── Internal gates ────────────────────────────────────────────────────────

  // Project read access: Owner (any in org), owning PM, or a ProjectMember.
  // ADMIN and non-members → 404 (hides existence).
  async findAccessibleProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<{ id: string; status: ProjectStatus; managerId: string }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: caller.organizationId },
      select: { id: true, status: true, managerId: true },
    });
    if (!project) throw notFound();

    if (caller.role === Role.ADMIN) throw notFound();
    if (caller.role === Role.OWNER) return project;
    if (project.managerId === caller.userId) return project;

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: caller.userId } },
      select: { id: true },
    });
    if (!membership) throw notFound();

    return project;
  }

  // Project write access: owning PM or Owner. Others → 404 (not 403)
  // to avoid leaking existence across PMs.
  private async findManagedProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<{ id: string; status: ProjectStatus; managerId: string }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: caller.organizationId },
      select: { id: true, status: true, managerId: true },
    });
    if (!project) throw notFound();

    if (caller.role === Role.OWNER) return project;
    if (
      caller.role === Role.PROJECT_MANAGER &&
      project.managerId === caller.userId
    ) {
      return project;
    }

    if (caller.role === Role.PROJECT_MANAGER || caller.role === Role.ADMIN) {
      throw notFound();
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message:
        'Only the owning Project Manager or Owner can perform this action.',
    });
  }

  // Load a task + its project for PM/Owner write operations.
  private async findTaskForManagement(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<{
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    priority: Priority;
    dueDate: Date | null;
    project: { status: ProjectStatus; managerId: string };
  }> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: {
        id: true,
        projectId: true,
        title: true,
        description: true,
        priority: true,
        dueDate: true,
        project: { select: { status: true, managerId: true } },
      },
    });
    if (!task) throw notFound();

    // Apply managed-project gate
    await this.findManagedProject(caller, task.projectId);
    return task;
  }

  private async assertProjectMembers(
    projectId: string,
    userIds: string[],
  ): Promise<void> {
    for (const userId of userIds) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { id: true },
      });
      if (!member) {
        throw new ConflictException({
          code: 'NOT_A_MEMBER',
          message: `User ${userId} is not a member of this project.`,
        });
      }
    }
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RawTask = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: Date | null;
  position: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  assignees: { user: { id: string; name: string; email: string } }[];
  labels: { label: { id: string; name: string; color: string } }[];
  _count: { checklist: number };
  checklist: { isChecked: boolean }[];
};

function toTaskRow(raw: RawTask): TaskRow {
  return {
    id: raw.id,
    projectId: raw.projectId,
    columnId: raw.columnId,
    title: raw.title,
    description: raw.description,
    priority: raw.priority,
    dueDate: raw.dueDate,
    position: raw.position,
    createdById: raw.createdById,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    assignees: raw.assignees.map((a) => ({
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
    })),
    labels: raw.labels.map((l) => ({
      id: l.label.id,
      name: l.label.name,
      color: l.label.color,
    })),
    checklistTotal: raw._count.checklist,
    checklistDone: raw.checklist.filter((c) => c.isChecked).length,
  };
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Task was not found.',
  });
}
