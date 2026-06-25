import {
  Priority,
  ProjectStatus,
  Role,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantContextBuilder } from './assistant-context.builder';

type MockPrisma = {
  user: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  task: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
};

const admin: CurrentUserPayload = {
  userId: 'admin-1',
  role: Role.ADMIN,
  organizationId: 'org-1',
};

const pm: CurrentUserPayload = {
  userId: 'pm-1',
  role: Role.PROJECT_MANAGER,
  organizationId: 'org-1',
};

const collaborator: CurrentUserPayload = {
  userId: 'collab-1',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

describe('AssistantContextBuilder', () => {
  let prisma: MockPrisma;
  let builder: AssistantContextBuilder;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };
    builder = new AssistantContextBuilder(prisma as unknown as PrismaService);
  });

  it('builds admin context without querying task content', async () => {
    prisma.user.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2);
    prisma.user.findMany.mockResolvedValue([
      {
        name: 'Alex Admin',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    ]);

    const context = await builder.build(admin);

    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: UserStatus.PENDING },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(context.summary).toContain(
      'Do not include project or task content for Admin users.',
    );
    expect(context.summary).toContain('Org users: 7');
    expect(context.summary).toContain('Pending invites: 2');
    expect(context.summary).toContain('Alex Admin (ADMIN, ACTIVE)');
  });

  it('scopes PM task snapshots to org active projects managed by or joined by the caller', async () => {
    await builder.build(pm);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          project: {
            organizationId: 'org-1',
            status: ProjectStatus.ACTIVE,
            OR: [
              { managerId: 'pm-1' },
              { members: { some: { userId: 'pm-1' } } },
            ],
          },
        },
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
        take: 25,
      }),
    );
  });

  it('scopes collaborator task snapshots to org active projects where the caller is a member', async () => {
    await builder.build(collaborator);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          project: {
            organizationId: 'org-1',
            status: ProjectStatus.ACTIVE,
            members: { some: { userId: 'collab-1' } },
          },
        },
      }),
    );
  });

  it('selects task metadata and attachment counts without attachment storage fields', async () => {
    await builder.build(pm);

    const findManyArgs = firstTaskFindManyArgs(prisma);
    const select = findManyArgs.select as Record<string, unknown>;
    expect(select).toMatchObject({
      title: true,
      priority: true,
      dueDate: true,
      project: { select: { name: true } },
      column: { select: { name: true } },
      _count: { select: { comments: true, attachments: true } },
    });
    expect(select).not.toHaveProperty('attachments');
  });

  it('uses org and accessible active project filters for focused task lookup', async () => {
    prisma.task.findFirst.mockResolvedValue({
      title: 'Review launch copy',
      priority: Priority.HIGH,
      dueDate: new Date('2026-06-30T00:00:00.000Z'),
      project: { name: 'Website' },
      column: { name: 'Review' },
    });

    const context = await builder.build(pm, {
      route: '/tasks/task-1',
      taskId: 'task-1',
    });

    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'task-1',
          organizationId: 'org-1',
          project: {
            organizationId: 'org-1',
            status: ProjectStatus.ACTIVE,
            OR: [
              { managerId: 'pm-1' },
              { members: { some: { userId: 'pm-1' } } },
            ],
          },
        },
      }),
    );
    expect(context.summary).toContain(
      'Focused task: Review launch copy in Website, Review, HIGH, due 2026-06-30.',
    );
  });

  it('summarizes no focused task when task id is inaccessible or missing', async () => {
    prisma.task.findFirst.mockResolvedValue(null);

    const context = await builder.build(collaborator, {
      route: '/tasks/task-2',
      taskId: 'task-2',
    });

    expect(context.summary).toContain('No focused task.');
  });
});

function firstTaskFindManyArgs(prisma: MockPrisma): Prisma.TaskFindManyArgs {
  const [args] = prisma.task.findMany.mock.calls[0] as [
    Prisma.TaskFindManyArgs,
  ];
  return args;
}
