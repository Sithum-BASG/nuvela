import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyLabelDto } from './dto/apply-label.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import type { LabelRow } from './tasks.service';
import { TasksService } from './tasks.service';

@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async listLabels(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<LabelRow[]> {
    await this.tasksService.findAccessibleProject(caller, projectId);
    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    });
  }

  async createLabel(
    caller: CurrentUserPayload,
    projectId: string,
    dto: CreateLabelDto,
  ): Promise<LabelRow> {
    const project = await this.findManagedProject(caller, projectId);
    this.assertNotArchived(project.status);

    return this.prisma.label.create({
      data: { projectId, name: dto.name, color: dto.color },
      select: { id: true, name: true, color: true },
    });
  }

  async updateLabel(
    caller: CurrentUserPayload,
    labelId: string,
    dto: UpdateLabelDto,
  ): Promise<LabelRow> {
    const label = await this.loadLabelForManagement(caller, labelId);
    this.assertNotArchived(label.project.status);

    return this.prisma.label.update({
      where: { id: labelId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      select: { id: true, name: true, color: true },
    });
  }

  async deleteLabel(
    caller: CurrentUserPayload,
    labelId: string,
  ): Promise<void> {
    const label = await this.loadLabelForManagement(caller, labelId);
    this.assertNotArchived(label.project.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.taskLabel.deleteMany({ where: { labelId } });
      await tx.label.delete({ where: { id: labelId } });
    });
  }

  async applyLabel(
    caller: CurrentUserPayload,
    taskId: string,
    dto: ApplyLabelDto,
  ): Promise<void> {
    // Load task, check project access (PM/Owner)
    const task = await this.loadTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    // Label must belong to the task's project
    const label = await this.prisma.label.findFirst({
      where: { id: dto.labelId, projectId: task.projectId },
      select: { id: true },
    });
    if (!label) {
      throw new ConflictException({
        code: 'INVALID_LABEL',
        message: 'Label does not belong to this project.',
      });
    }

    // Idempotent — unique constraint [taskId, labelId]
    const existing = await this.prisma.taskLabel.findUnique({
      where: { taskId_labelId: { taskId, labelId: dto.labelId } },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.taskLabel.create({ data: { taskId, labelId: dto.labelId } });
        await tx.activityLog.create({
          data: {
            taskId,
            actorId: caller.userId,
            type: ActivityType.FIELD_CHANGED,
            metadata: { field: 'labels' },
          },
        });
      });
    }
  }

  async removeLabel(
    caller: CurrentUserPayload,
    taskId: string,
    labelId: string,
  ): Promise<void> {
    const task = await this.loadTaskForManagement(caller, taskId);
    this.assertNotArchived(task.project.status);

    const existing = await this.prisma.taskLabel.findUnique({
      where: { taskId_labelId: { taskId, labelId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.taskLabel.delete({
          where: { taskId_labelId: { taskId, labelId } },
        });
        await tx.activityLog.create({
          data: {
            taskId,
            actorId: caller.userId,
            type: ActivityType.FIELD_CHANGED,
            metadata: { field: 'labels' },
          },
        });
      });
    }
  }

  // ─── Internal gates ────────────────────────────────────────────────────────

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

  private async loadLabelForManagement(
    caller: CurrentUserPayload,
    labelId: string,
  ): Promise<{
    id: string;
    projectId: string;
    project: { status: ProjectStatus; managerId: string };
  }> {
    const label = await this.prisma.label.findFirst({
      where: {
        id: labelId,
        project: { organizationId: caller.organizationId },
      },
      select: {
        id: true,
        projectId: true,
        project: { select: { status: true, managerId: true } },
      },
    });
    if (!label) throw notFound();
    await this.findManagedProject(caller, label.projectId);
    return label;
  }

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
    await this.findManagedProject(caller, task.projectId);
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
