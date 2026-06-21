import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

type DeadlineKind = '24h' | 'overdue';

@Injectable()
export class DeadlineScanner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    await this.scan();
  }

  async scan(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { not: null, lte: in24h },
        project: { status: ProjectStatus.ACTIVE },
        column: { isCompletedColumn: false },
      },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        title: true,
        dueDate: true,
        assignees: { select: { userId: true } },
        project: { select: { managerId: true } },
      },
    });

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const kind: DeadlineKind =
        task.dueDate.getTime() < now.getTime() ? 'overdue' : '24h';

      const recipientIds =
        task.assignees.length > 0
          ? task.assignees.map((a) => a.userId)
          : [task.project.managerId];

      for (const recipientId of recipientIds) {
        const exists = await this.hasExistingDeadlineNotification(
          recipientId,
          task.id,
          kind,
        );
        if (exists) continue;

        await this.notificationsService.notify({
          organizationId: task.organizationId,
          recipientId,
          type: NotificationType.DEADLINE,
          payload: {
            taskId: task.id,
            projectId: task.projectId,
            title: task.title,
            kind,
          },
        });
      }
    }
  }

  private async hasExistingDeadlineNotification(
    recipientId: string,
    taskId: string,
    kind: DeadlineKind,
  ): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        recipientId,
        type: NotificationType.DEADLINE,
        AND: [
          { payload: { path: ['taskId'], equals: taskId } },
          { payload: { path: ['kind'], equals: kind } },
        ],
      },
      select: { id: true },
    });
    return existing !== null;
  }
}
