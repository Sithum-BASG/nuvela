import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationRow = {
  id: string;
  type: NotificationType;
  payload: unknown;
  isRead: boolean;
  createdAt: Date;
};

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  payload: true,
  isRead: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwn(
    caller: CurrentUserPayload,
    opts?: { unreadOnly?: boolean },
  ): Promise<NotificationRow[]> {
    return this.prisma.notification.findMany({
      where: {
        recipientId: caller.userId,
        organizationId: caller.organizationId,
        ...(opts?.unreadOnly && { isRead: false }),
      },
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(caller: CurrentUserPayload, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientId: caller.userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      });
    }
  }

  async markAllRead(caller: CurrentUserPayload): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: caller.userId, isRead: false },
      data: { isRead: true },
    });
  }
}
