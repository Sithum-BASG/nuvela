import { Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

type MockPrisma = {
  task: {
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

const admin: CurrentUserPayload = {
  userId: 'admin-1',
  role: Role.ADMIN,
  organizationId: 'org-1',
};

describe('SearchService', () => {
  let prisma: MockPrisma;
  let service: SearchService;

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new SearchService(prisma as unknown as PrismaService);
  });

  it('returns [] for empty q', async () => {
    await expect(service.search(owner, '   ')).resolves.toEqual([]);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('returns [] for ADMIN without querying tasks', async () => {
    await expect(service.search(admin, 'billing')).resolves.toEqual([]);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('scopes collaborator search to member projects and org', async () => {
    await service.search(collaborator, 'invoice');

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          project: {
            organizationId: 'org-1',
            members: { some: { userId: 'collab-1' } },
          },
          OR: [
            { title: { contains: 'invoice', mode: 'insensitive' } },
            { description: { contains: 'invoice', mode: 'insensitive' } },
          ],
        },
        take: 50,
      }),
    );
  });

  it('scopes PM search to managed or member projects', async () => {
    await service.search(pm, 'deploy');

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          project: {
            organizationId: 'org-1',
            OR: [
              { managerId: 'pm-1' },
              { members: { some: { userId: 'pm-1' } } },
            ],
          },
          OR: [
            { title: { contains: 'deploy', mode: 'insensitive' } },
            { description: { contains: 'deploy', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('matches title or description case-insensitively and maps results', async () => {
    const dueDate = new Date('2026-06-20T00:00:00.000Z');
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Billing migration',
        projectId: 'project-1',
        dueDate,
        project: { name: 'Nuvela' },
        column: { name: 'In Progress' },
      },
    ]);

    const results = await service.search(owner, 'BILLING');

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          project: { organizationId: 'org-1' },
          OR: [
            { title: { contains: 'BILLING', mode: 'insensitive' } },
            { description: { contains: 'BILLING', mode: 'insensitive' } },
          ],
        },
      }),
    );
    expect(results).toEqual([
      {
        taskId: 'task-1',
        title: 'Billing migration',
        projectId: 'project-1',
        projectName: 'Nuvela',
        columnName: 'In Progress',
        dueDate,
      },
    ]);
  });
});
