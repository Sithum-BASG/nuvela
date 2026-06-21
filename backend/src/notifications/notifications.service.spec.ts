import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const caller: CurrentUserPayload = {
    userId: 'user-a',
    role: Role.COLLABORATOR,
    organizationId: 'org-1',
  };

  const createService = () => {
    const prisma = {
      notification: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const gateway = { emitToUser: jest.fn() };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      gateway as unknown as NotificationsGateway,
    );
    return { service, prisma, gateway };
  };

  it('listOwn filters by recipient, org, and unread', async () => {
    const { service, prisma } = createService();
    prisma.notification.findMany.mockResolvedValue([]);

    await service.listOwn(caller, { unreadOnly: true });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        recipientId: 'user-a',
        organizationId: 'org-1',
        isRead: false,
      },
      select: expect.any(Object) as object,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('markRead throws NotFound when no row matches the caller', async () => {
    const { service, prisma } = createService();
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markRead(caller, 'foreign-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('markAllRead updates only the caller unread rows', async () => {
    const { service, prisma } = createService();
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await service.markAllRead(caller);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'user-a', isRead: false },
      data: { isRead: true },
    });
  });
});
