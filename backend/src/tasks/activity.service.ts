import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

export type ActivityRow = {
  id: string;
  type: ActivityType;
  metadata: unknown;
  createdAt: Date;
  actor: { id: string; name: string };
};

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async getActivity(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<ActivityRow[]> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: { id: true, projectId: true },
    });
    if (!task) throw notFound();

    await this.tasksService.findAccessibleProject(caller, task.projectId);

    return this.prisma.activityLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    });
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Resource was not found.',
  });
}
