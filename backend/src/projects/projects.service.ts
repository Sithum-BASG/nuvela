import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStatus, Role } from '@prisma/client';
import { ColumnsService } from '../columns/columns.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { TransferProjectDto } from './dto/transfer-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export type ProjectRow = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  managerId: string;
  memberCount: number;
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
      return rows.map(toProjectRow);
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      const rows = await this.prisma.project.findMany({
        where: { ...baseWhere, managerId: caller.userId },
        select: PROJECT_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(toProjectRow);
    }

    // COLLABORATOR: only projects they are a member of.
    const rows = await this.prisma.project.findMany({
      where: { ...baseWhere, members: { some: { userId: caller.userId } } },
      select: PROJECT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toProjectRow);
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
      return rows.map(toProjectRow);
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      const rows = await this.prisma.project.findMany({
        where: { ...baseWhere, managerId: caller.userId },
        select: PROJECT_SELECT,
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map(toProjectRow);
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
    await this.findManagedProject(caller, projectId);

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
    return toProjectRow(updated);
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
}

function toProjectRow(project: ProjectWithCount): ProjectRow {
  const { _count, ...rest } = project;
  return { ...rest, memberCount: _count.members };
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Project was not found.',
  });
}
