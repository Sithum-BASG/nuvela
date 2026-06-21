import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

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

  async notify(input: {
    organizationId: string;
    recipientId: string;
    type: NotificationType;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const row = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        recipientId: input.recipientId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });

    try {
      this.gateway.emitToUser(input.recipientId, 'notification', {
        id: row.id,
        type: input.type,
        payload: input.payload,
        isRead: false,
        createdAt: row.createdAt,
      });
    } catch {
      // Persist-then-push: socket errors must not fail the originating request.
    }
  }

  async notifyMany(
    organizationId: string,
    recipientIds: string[],
    type: NotificationType,
    payload: Record<string, unknown>,
    actorId?: string,
  ): Promise<void> {
    const uniqueRecipients = [
      ...new Set(recipientIds.filter((id): id is string => Boolean(id))),
    ].filter((id) => id !== actorId);

    await Promise.all(
      uniqueRecipients.map((recipientId) =>
        this.notify({ organizationId, recipientId, type, payload }),
      ),
    );
  }
}
