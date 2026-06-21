import { Injectable } from '@nestjs/common';
import {
  Priority,
  ProjectStatus,
  Role,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export type MyTaskRow = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  columnName: string;
  isCompletedColumn: boolean;
  priority: Priority;
  dueDate: Date | null;
};

export type ProjectProgressRow = {
  id: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
};

export type OrgOverview = {
  userCounts: {
    OWNER: number;
    ADMIN: number;
    PROJECT_MANAGER: number;
    COLLABORATOR: number;
  };
  pendingInvites: number;
  projectCount: number;
  recentUsers: {
    id: string;
    name: string;
    role: Role;
    status: string;
    createdAt: Date;
  }[];
};

export type MyWorkResult = {
  tasks: MyTaskRow[];
  projects: ProjectProgressRow[];
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async myWork(caller: CurrentUserPayload): Promise<MyWorkResult> {
    const [tasks, projects] = await Promise.all([
      this.fetchAssignedTasks(caller),
      this.fetchProjectProgress(caller),
    ]);
    return { tasks, projects };
  }

  async orgOverview(caller: CurrentUserPayload): Promise<OrgOverview> {
    const orgId = caller.organizationId;

    const [roleGroups, pendingInvites, projectCount, recentUsers] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['role'],
          where: { organizationId: orgId },
          _count: { id: true },
        }),
        this.prisma.user.count({
          where: { organizationId: orgId, status: UserStatus.PENDING },
        }),
        this.prisma.project.count({
          where: {
            organizationId: orgId,
            status: ProjectStatus.ACTIVE,
          },
        }),
        this.prisma.user.findMany({
          where: { organizationId: orgId },
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const userCounts = {
      OWNER: 0,
      ADMIN: 0,
      PROJECT_MANAGER: 0,
      COLLABORATOR: 0,
    };
    for (const group of roleGroups) {
      userCounts[group.role] = group._count.id;
    }

    return {
      userCounts,
      pendingInvites,
      projectCount,
      recentUsers,
    };
  }

  private async fetchAssignedTasks(
    caller: CurrentUserPayload,
  ): Promise<MyTaskRow[]> {
    const rows = await this.prisma.task.findMany({
      where: {
        organizationId: caller.organizationId,
        assignees: { some: { userId: caller.userId } },
        project: { status: ProjectStatus.ACTIVE },
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        priority: true,
        dueDate: true,
        project: { select: { name: true } },
        column: { select: { name: true, isCompletedColumn: true } },
      },
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      take: 100,
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      projectId: row.projectId,
      projectName: row.project.name,
      columnName: row.column.name,
      isCompletedColumn: row.column.isCompletedColumn,
      priority: row.priority,
      dueDate: row.dueDate,
    }));
  }

  private async fetchProjectProgress(
    caller: CurrentUserPayload,
  ): Promise<ProjectProgressRow[]> {
    const projectWhere = this.accessibleActiveProjectsWhere(caller);

    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });

    if (projects.length === 0) {
      return [];
    }

    const projectIds = projects.map((p) => p.id);

    const [totalCounts, completedCounts] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds } },
        _count: { id: true },
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          column: { isCompletedColumn: true },
        },
        _count: { id: true },
      }),
    ]);

    const totalByProject = new Map(
      totalCounts.map((row) => [row.projectId, row._count.id]),
    );
    const completedByProject = new Map(
      completedCounts.map((row) => [row.projectId, row._count.id]),
    );

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      totalTasks: totalByProject.get(project.id) ?? 0,
      completedTasks: completedByProject.get(project.id) ?? 0,
    }));
  }

  // Mirrors project read access in TasksService.findAccessibleProject /
  // ProjectsService.listProjects: Owner → all org ACTIVE; PM → managed;
  // Collaborator → member projects; Admin → none (endpoint is role-gated).
  private accessibleActiveProjectsWhere(
    caller: CurrentUserPayload,
  ): Prisma.ProjectWhereInput {
    const base: Prisma.ProjectWhereInput = {
      organizationId: caller.organizationId,
      status: ProjectStatus.ACTIVE,
    };

    if (caller.role === Role.OWNER) {
      return base;
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      return { ...base, managerId: caller.userId };
    }

    if (caller.role === Role.COLLABORATOR) {
      return {
        ...base,
        members: { some: { userId: caller.userId } },
      };
    }

    // ADMIN has no project content access; my-work is @Roles-gated away.
    return { ...base, id: '__none__' };
  }
}
