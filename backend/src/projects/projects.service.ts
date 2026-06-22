import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStatus, Role, NotificationType } from '@prisma/client';
import { ColumnsService } from '../columns/columns.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { TransferProjectDto } from './dto/transfer-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export type ProjectMemberPreview = {
  userId: string;
  name: string;
};

export type ProjectRow = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  managerId: string;
  memberCount: number;
  totalTasks: number;
  completedTasks: number;
  memberPreview: ProjectMemberPreview[];
  createdAt: Date;
  updatedAt: Date;
};

// Raw project shape from Prisma with the membership count included, before we
// flatten _count into memberCount for the API response.
type ProjectWithCount = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  managerId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { members: number };
};

const PROJECT_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  color: true,
  status: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly columnsService: ColumnsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listProjects(caller: CurrentUserPayload): Promise<ProjectRow[]> {
    // ADMIN never sees project contents (Backend Schema authorization matrix).
    if (caller.role === Role.ADMIN) {
      return [];
    }

    const baseWhere = {
      organizationId: caller.organizationId,
      status: ProjectStatus.ACTIVE,
    };

    if (caller.role === Role.OWNER) {
      const rows = await this.prisma.project.findMany({
        where: baseWhere,
        select: PROJECT_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      return this.enrichProjectRows(rows);
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      const rows = await this.prisma.project.findMany({
        where: { ...baseWhere, managerId: caller.userId },
        select: PROJECT_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      return this.enrichProjectRows(rows);
    }

    // COLLABORATOR: only projects they are a member of.
    const rows = await this.prisma.project.findMany({
      where: { ...baseWhere, members: { some: { userId: caller.userId } } },
      select: PROJECT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichProjectRows(rows);
  }

  async listArchivedProjects(
    caller: CurrentUserPayload,
  ): Promise<ProjectRow[]> {
    const baseWhere = {
      organizationId: caller.organizationId,
      status: ProjectStatus.ARCHIVED,
    };

    if (caller.role === Role.OWNER) {
      const rows = await this.prisma.project.findMany({
        where: baseWhere,
        select: PROJECT_SELECT,
        orderBy: { updatedAt: 'desc' },
      });
      return this.enrichProjectRows(rows);
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      const rows = await this.prisma.project.findMany({
        where: { ...baseWhere, managerId: caller.userId },
        select: PROJECT_SELECT,
        orderBy: { updatedAt: 'desc' },
      });
      return this.enrichProjectRows(rows);
    }

    // Collaborators and Admins don't have an archived list (App Flow §nav).
    return [];
  }

  async getProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ProjectRow> {
    const project = await this.findAccessibleProject(caller, projectId);
    return toProjectRow(project);
  }

  async createProject(
    caller: CurrentUserPayload,
    dto: CreateProjectDto,
  ): Promise<ProjectRow> {
    const project = await this.prisma.project.create({
      data: {
        organizationId: caller.organizationId,
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color,
        status: ProjectStatus.ACTIVE,
        managerId: caller.userId,
        // The manager is always a member of their own project.
        members: { create: { userId: caller.userId } },
      },
      select: { id: true },
    });

    await this.columnsService.seedDefaultColumns(project.id);

    const created = await this.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: PROJECT_SELECT,
    });
    return toProjectRow(created);
  }

  async updateProject(
    caller: CurrentUserPayload,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectRow> {
    const project = await this.findManagedProject(caller, projectId);
    this.assertNotArchived(project.status);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      select: PROJECT_SELECT,
    });
    return toProjectRow(updated);
  }

  async archiveProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<void> {
    await this.findManagedProject(caller, projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ARCHIVED },
    });
  }

  async unarchiveProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<void> {
    await this.findManagedProject(caller, projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ACTIVE },
    });
  }

  async transferProject(
    caller: CurrentUserPayload,
    projectId: string,
    dto: TransferProjectDto,
  ): Promise<ProjectRow> {
    const project = await this.findManagedProject(caller, projectId);
    const previousManagerId = project.managerId;

    // The new manager must be a PM or Owner in the same organization.
    const newManager = await this.prisma.user.findFirst({
      where: {
        id: dto.newManagerId,
        organizationId: caller.organizationId,
        role: { in: [Role.PROJECT_MANAGER, Role.OWNER] },
      },
      select: { id: true },
    });
    if (!newManager) {
      throw new ConflictException({
        code: 'INVALID_MANAGER',
        message: 'The new manager must be a Project Manager or Owner.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // The new manager is always a member of the project.
      await tx.projectMember.upsert({
        where: {
          projectId_userId: { projectId, userId: dto.newManagerId },
        },
        create: { projectId, userId: dto.newManagerId },
        update: {},
      });
      return tx.project.update({
        where: { id: projectId },
        data: { managerId: dto.newManagerId },
        select: PROJECT_SELECT,
      });
    });
    const row = toProjectRow(updated);

    await this.notificationsService.notifyMany(
      caller.organizationId,
      [dto.newManagerId, previousManagerId],
      NotificationType.PROJECT_TRANSFERRED,
      { projectId, name: row.name },
      caller.userId,
    );

    return row;
  }

  // Project read access: Owner (any in org), owning PM, or a member. Else 404
  // (NotFound hides cross-tenant / non-member existence per the authz matrix).
  private async findAccessibleProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ProjectWithCount> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: caller.organizationId },
      select: PROJECT_SELECT,
    });
    if (!project) {
      throw notFound();
    }

    if (caller.role === Role.OWNER) {
      return project;
    }
    if (caller.role === Role.ADMIN) {
      // Admins never access project contents.
      throw notFound();
    }
    if (project.managerId === caller.userId) {
      return project;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: caller.userId } },
      select: { id: true },
    });
    if (!membership) {
      throw notFound();
    }
    return project;
  }

  // Project write access: owning PM or Owner only. Non-owners get 404 (not 403)
  // so a PM can't probe another PM's project existence.
  private async findManagedProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ProjectWithCount> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: caller.organizationId },
      select: PROJECT_SELECT,
    });
    if (!project) {
      throw notFound();
    }

    if (caller.role === Role.OWNER) {
      return project;
    }
    if (
      caller.role === Role.PROJECT_MANAGER &&
      project.managerId === caller.userId
    ) {
      return project;
    }

    // A member/collaborator who is not the manager is forbidden from writes;
    // a non-member or other-PM gets 404 to avoid leaking existence.
    if (caller.role === Role.PROJECT_MANAGER || caller.role === Role.ADMIN) {
      throw notFound();
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only the owning Project Manager or Owner can change a project.',
    });
  }

  private assertNotArchived(status: ProjectStatus): void {
    if (status === ProjectStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'PROJECT_ARCHIVED',
        message: 'Archived projects are read-only. Unarchive it first.',
      });
    }
  }

  // List screens show task totals and a member avatar preview (Figma Project
  // List Row + Project Card). Single-project endpoints omit this enrichment.
  private async enrichProjectRows(
    rows: ProjectWithCount[],
  ): Promise<ProjectRow[]> {
    if (rows.length === 0) {
      return [];
    }

    const projectIds = rows.map((row) => row.id);

    const [totalCounts, completedCounts, members] = await Promise.all([
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
      this.prisma.projectMember.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          projectId: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalByProject = new Map(
      totalCounts.map((row) => [row.projectId, row._count.id]),
    );
    const completedByProject = new Map(
      completedCounts.map((row) => [row.projectId, row._count.id]),
    );

    const previewByProject = new Map<string, ProjectMemberPreview[]>();
    for (const member of members) {
      const preview = previewByProject.get(member.projectId) ?? [];
      if (preview.length < 3) {
        preview.push({ userId: member.user.id, name: member.user.name });
        previewByProject.set(member.projectId, preview);
      }
    }

    return rows.map((project) =>
      toProjectRow(project, {
        totalTasks: totalByProject.get(project.id) ?? 0,
        completedTasks: completedByProject.get(project.id) ?? 0,
        memberPreview: previewByProject.get(project.id) ?? [],
      }),
    );
  }
}

function toProjectRow(
  project: ProjectWithCount,
  stats?: {
    totalTasks: number;
    completedTasks: number;
    memberPreview: ProjectMemberPreview[];
  },
): ProjectRow {
  const { _count, ...rest } = project;
  return {
    ...rest,
    memberCount: _count.members,
    totalTasks: stats?.totalTasks ?? 0,
    completedTasks: stats?.completedTasks ?? 0,
    memberPreview: stats?.memberPreview ?? [],
  };
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Project was not found.',
  });
}
