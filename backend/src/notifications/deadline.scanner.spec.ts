import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeadlineScanner } from './deadline.scanner';
import { NotificationsService } from './notifications.service';

describe('DeadlineScanner', () => {
  const createScanner = () => {
    const prisma = {
      task: { findMany: jest.fn() },
      notification: { findFirst: jest.fn() },
    };
    const notificationsService = { notify: jest.fn() };
    const scanner = new DeadlineScanner(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
    return { scanner, prisma, notificationsService };
  };

  const dueIn12h = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const overdue = new Date(Date.now() - 60 * 60 * 1000);

  it('skips tasks in the Completed column (filtered out by query)', async () => {
    const { scanner, prisma, notificationsService } = createScanner();
    prisma.task.findMany.mockResolvedValue([]);

    await scanner.scan();

    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('notifies assignees for a Review task due in 12h', async () => {
    const { scanner, prisma, notificationsService } = createScanner();
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        organizationId: 'org-1',
        projectId: 'project-1',
        title: 'Ship feature',
        dueDate: dueIn12h,
        assignees: [{ userId: 'user-a' }, { userId: 'user-b' }],
        project: { managerId: 'pm-1' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);

    await scanner.scan();

    expect(notificationsService.notify).toHaveBeenCalledTimes(2);
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'user-a',
        type: NotificationType.DEADLINE,
        payload: expect.objectContaining({ kind: '24h' }) as object,
      }),
    );
  });

  it('notifies only the PM when the task is unassigned and overdue', async () => {
    const { scanner, prisma, notificationsService } = createScanner();
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-2',
        organizationId: 'org-1',
        projectId: 'project-1',
        title: 'Overdue task',
        dueDate: overdue,
        assignees: [],
        project: { managerId: 'pm-1' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);

    await scanner.scan();

    expect(notificationsService.notify).toHaveBeenCalledTimes(1);
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'pm-1',
        payload: expect.objectContaining({ kind: 'overdue' }) as object,
      }),
    );
  });

  it('does not create duplicate notifications on a second scan', async () => {
    const { scanner, prisma, notificationsService } = createScanner();
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        organizationId: 'org-1',
        projectId: 'project-1',
        title: 'Ship feature',
        dueDate: dueIn12h,
        assignees: [{ userId: 'user-a' }],
        project: { managerId: 'pm-1' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'existing' });

    await scanner.scan();

    expect(notificationsService.notify).not.toHaveBeenCalled();
  });
});
