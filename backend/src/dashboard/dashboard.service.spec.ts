import { Priority, ProjectStatus, Role, UserStatus } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

type MockPrisma = {
  task: {
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
  project: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  user: {
    groupBy: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
};

const owner: CurrentUserPayload = {
  userId: 'owner-1',
  role: Role.OWNER,
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

describe('DashboardService', () => {
  let prisma: MockPrisma;
  let service: DashboardService;

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  describe('myWork', () => {
    it('returns assigned tasks and accessible project progress with completed counts', async () => {
      const dueDate = new Date('2026-06-20T00:00:00.000Z');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Ship dashboard',
          projectId: 'project-1',
          priority: Priority.HIGH,
          dueDate,
          project: { name: 'Nuvela' },
          column: { name: 'In Progress', isCompletedColumn: false },
        },
      ]);
      prisma.project.findMany.mockResolvedValue([
        { id: 'project-1', name: 'Nuvela', color: '#6366F1' },
      ]);
      prisma.task.groupBy
        .mockResolvedValueOnce([{ projectId: 'project-1', _count: { id: 4 } }])
        .mockResolvedValueOnce([{ projectId: 'project-1', _count: { id: 1 } }]);

      const result = await service.myWork(pm);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            assignees: { some: { userId: 'pm-1' } },
            project: { status: ProjectStatus.ACTIVE },
          },
          take: 100,
        }),
      );
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            status: ProjectStatus.ACTIVE,
            managerId: 'pm-1',
          },
        }),
      );
      expect(result.tasks).toEqual([
        {
          id: 'task-1',
          title: 'Ship dashboard',
          projectId: 'project-1',
          projectName: 'Nuvela',
          columnName: 'In Progress',
          isCompletedColumn: false,
          priority: Priority.HIGH,
          dueDate,
        },
      ]);
      expect(result.projects).toEqual([
        {
          id: 'project-1',
          name: 'Nuvela',
          color: '#6366F1',
          totalTasks: 4,
          completedTasks: 1,
        },
      ]);
    });

    it('scopes collaborator project progress to member projects', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.project.findMany.mockResolvedValue([]);

      await service.myWork(collaborator);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            status: ProjectStatus.ACTIVE,
            members: { some: { userId: 'collab-1' } },
          },
        }),
      );
    });
  });

  describe('orgOverview', () => {
    it('returns org-scoped role counts, pending invites, project count, and recent users', async () => {
      const createdAt = new Date('2026-06-16T00:00:00.000Z');
      prisma.user.groupBy.mockResolvedValue([
        { role: Role.OWNER, _count: { id: 1 } },
        { role: Role.ADMIN, _count: { id: 2 } },
        { role: Role.PROJECT_MANAGER, _count: { id: 3 } },
        { role: Role.COLLABORATOR, _count: { id: 4 } },
      ]);
      prisma.user.count.mockResolvedValue(2);
      prisma.project.count.mockResolvedValue(5);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-5',
          name: 'New User',
          role: Role.COLLABORATOR,
          status: UserStatus.PENDING,
          createdAt,
        },
      ]);

      const result = await service.orgOverview(owner);

      expect(prisma.user.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          status: UserStatus.PENDING,
        },
      });
      expect(prisma.project.count).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          status: ProjectStatus.ACTIVE,
        },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual({
        userCounts: {
          OWNER: 1,
          ADMIN: 2,
          PROJECT_MANAGER: 3,
          COLLABORATOR: 4,
        },
        pendingInvites: 2,
        projectCount: 5,
        recentUsers: [
          {
            id: 'user-5',
            name: 'New User',
            role: Role.COLLABORATOR,
            status: UserStatus.PENDING,
            createdAt,
          },
        ],
      });
    });
  });
});
