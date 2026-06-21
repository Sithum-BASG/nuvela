import { Injectable } from '@nestjs/common';
import { Role, type Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export type SearchResult = {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  columnName: string;
  dueDate: Date | null;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(caller: CurrentUserPayload, q: string): Promise<SearchResult[]> {
    const trimmed = q.trim();
    if (!trimmed || caller.role === Role.ADMIN) {
      return [];
    }

    const rows = await this.prisma.task.findMany({
      where: {
        organizationId: caller.organizationId,
        project: this.accessibleProjectsWhere(caller),
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { description: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        dueDate: true,
        project: { select: { name: true } },
        column: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return rows.map((row) => ({
      taskId: row.id,
      title: row.title,
      projectId: row.projectId,
      projectName: row.project.name,
      columnName: row.column.name,
      dueDate: row.dueDate,
    }));
  }

  // Mirrors TasksService.findAccessibleProject read access:
  // Owner → all org projects; PM → managed or member; Collaborator → member; Admin → none.
  accessibleProjectsWhere(
    caller: CurrentUserPayload,
  ): Prisma.ProjectWhereInput {
    const orgScoped: Prisma.ProjectWhereInput = {
      organizationId: caller.organizationId,
    };

    if (caller.role === Role.OWNER) {
      return orgScoped;
    }

    if (caller.role === Role.PROJECT_MANAGER) {
      return {
        ...orgScoped,
        OR: [
          { managerId: caller.userId },
          { members: { some: { userId: caller.userId } } },
        ],
      };
    }

    if (caller.role === Role.COLLABORATOR) {
      return {
        ...orgScoped,
        members: { some: { userId: caller.userId } },
      };
    }

    return { ...orgScoped, id: '__none__' };
  }
}
