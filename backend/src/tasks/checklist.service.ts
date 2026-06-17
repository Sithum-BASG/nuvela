import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

export type ChecklistItemRow = {
  id: string;
  text: string;
  isChecked: boolean;
  position: number;
};

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async addItem(
    caller: CurrentUserPayload,
    taskId: string,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemRow> {
    const task = await this.loadTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    const maxPos = await this.prisma.checklistItem.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    return this.prisma.checklistItem.create({
      data: { taskId, text: dto.text, isChecked: false, position },
      select: { id: true, text: true, isChecked: true, position: true },
    });
  }

  async updateItem(
    caller: CurrentUserPayload,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemRow> {
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId },
      select: {
        id: true,
        taskId: true,
        text: true,
        isChecked: true,
        position: true,
        task: {
          select: {
            organizationId: true,
            projectId: true,
            project: { select: { status: true, managerId: true } },
            assignees: { select: { userId: true } },
          },
        },
      },
    });
    if (!item || item.task.organizationId !== caller.organizationId) {
      throw notFound();
    }

    this.assertNotArchived(item.task.project.status);

    const isPm =
      caller.role === Role.OWNER ||
      (caller.role === Role.PROJECT_MANAGER &&
        item.task.project.managerId === caller.userId);

    // Text change → PM/Owner only
    if (dto.text !== undefined && !isPm) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the PM or Owner can edit checklist item text.',
      });
    }

    // isChecked toggle → assignees + PM/Owner
    if (dto.isChecked !== undefined && !isPm) {
      const isAssignee = item.task.assignees.some(
        (a) => a.userId === caller.userId,
      );
      if (!isAssignee) {
        throw new ForbiddenException({
          code: 'NOT_ASSIGNEE',
          message: 'Only assignees or the PM can toggle checklist items.',
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.checklistItem.update({
        where: { id: itemId },
        data: {
          ...(dto.text !== undefined && { text: dto.text }),
          ...(dto.isChecked !== undefined && { isChecked: dto.isChecked }),
        },
        select: { id: true, text: true, isChecked: true, position: true },
      });

      // ActivityLog on isChecked transition
      if (dto.isChecked !== undefined && dto.isChecked !== item.isChecked) {
        await tx.activityLog.create({
          data: {
            taskId: item.taskId,
            actorId: caller.userId,
            type: dto.isChecked
              ? ActivityType.CHECKLIST_CHECKED
              : ActivityType.CHECKLIST_UNCHECKED,
            metadata: { itemId },
          },
        });
      }

      return result;
    });

    return updated;
  }

  async deleteItem(caller: CurrentUserPayload, itemId: string): Promise<void> {
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId },
      select: {
        id: true,
        taskId: true,
        task: {
          select: {
            organizationId: true,
            projectId: true,
            project: { select: { status: true, managerId: true } },
          },
        },
      },
    });
    if (!item || item.task.organizationId !== caller.organizationId) {
      throw notFound();
    }

    this.assertNotArchived(item.task.project.status);
    await this.loadTaskForManagement(caller, item.taskId);

    await this.prisma.checklistItem.delete({ where: { id: itemId } });
  }

  // ─── Internal gates ────────────────────────────────────────────────────────

  private async loadTaskForManagement(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<{
    id: string;
    projectId: string;
    project: { status: ProjectStatus; managerId: string };
  }> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: {
        id: true,
        projectId: true,
        project: { select: { status: true, managerId: true } },
      },
    });
    if (!task) throw notFound();

    const isPm =
      caller.role === Role.OWNER ||
      (caller.role === Role.PROJECT_MANAGER &&
        task.project.managerId === caller.userId);

    if (!isPm) {
      if (caller.role === Role.PROJECT_MANAGER || caller.role === Role.ADMIN) {
        throw notFound();
      }
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Only the owning Project Manager or Owner can perform this action.',
      });
    }

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
