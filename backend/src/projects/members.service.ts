import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RemoveMemberDto } from './dto/remove-member.dto';

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  addedAt: Date;
};

export type InviteCandidate = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// The minimal project shape the membership checks need.
type ProjectAccess = {
  id: string;
  managerId: string;
  status: ProjectStatus;
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<MemberRow[]> {
    await this.assertCanRead(caller, projectId);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
      addedAt: m.createdAt,
    }));
  }

  async addMember(
    caller: CurrentUserPayload,
    projectId: string,
    userId: string,
  ): Promise<MemberRow> {
    await this.assertCanManage(caller, projectId);

    // The invited user must exist in the same org.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: caller.organizationId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User was not found.',
      });
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'User is already a member of this project.',
      });
    }

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId },
      select: { userId: true, createdAt: true },
    });
    return {
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      addedAt: member.createdAt,
    };
  }

  // Removing a member who has assigned tasks requires reassignment decisions.
  // Without them, returns the task list (409) so the client shows the dialog.
  async removeMember(
    caller: CurrentUserPayload,
    projectId: string,
    userId: string,
    dto: RemoveMemberDto,
  ): Promise<{ assignedTasks: { id: string; title: string }[] }> {
    const project = await this.assertCanManage(caller, projectId);

    if (project.managerId === userId) {
      throw new ConflictException({
        code: 'CANNOT_REMOVE_MANAGER',
        message: 'The project manager cannot be removed from their project.',
      });
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Member was not found.',
      });
    }

    // The member's assigned tasks in THIS project.
    const assignedTasks = await this.prisma.task.findMany({
      where: { projectId, assignees: { some: { userId } } },
      select: { id: true, title: true },
    });

    if (assignedTasks.length > 0) {
      const reassignments = dto.reassignments ?? [];
      const covered = new Set(reassignments.map((r) => r.taskId));
      const allCovered = assignedTasks.every((t) => covered.has(t.id));
      if (!allCovered) {
        throw new ConflictException({
          code: 'TASKS_NEED_REASSIGNMENT',
          message: 'Reassign or unassign this member’s tasks before removal.',
          assignedTasks,
        });
      }

      // Validate each chosen new assignee is a remaining member (not the user
      // being removed). null means leave unassigned, which is allowed.
      for (const r of reassignments) {
        if (r.newAssigneeId === null) continue;
        if (r.newAssigneeId === userId) {
          throw new ConflictException({
            code: 'INVALID_REASSIGNEE',
            message: 'Cannot reassign a task to the member being removed.',
          });
        }
        const isMember = await this.prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId, userId: r.newAssigneeId },
          },
          select: { id: true },
        });
        if (!isMember) {
          throw new ConflictException({
            code: 'INVALID_REASSIGNEE',
            message: 'New assignee must be a member of this project.',
          });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        // Drop the removed member's assignments in this project.
        await tx.taskAssignee.deleteMany({
          where: { userId, task: { projectId } },
        });
        // Apply the chosen reassignments (skip nulls = leave unassigned).
        for (const r of reassignments) {
          if (r.newAssigneeId === null) continue;
          await tx.taskAssignee.upsert({
            where: {
              taskId_userId: { taskId: r.taskId, userId: r.newAssigneeId },
            },
            create: { taskId: r.taskId, userId: r.newAssigneeId },
            update: {},
          });
        }
        await tx.projectMember.delete({
          where: { projectId_userId: { projectId, userId } },
        });
      });

      return { assignedTasks: [] };
    }

    // No assigned tasks: remove membership directly.
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    return { assignedTasks: [] };
  }

  // Minimal directory of org users a PM can invite: active PMs/Collaborators
  // who aren't already members of this project.
  async listInviteCandidates(
    caller: CurrentUserPayload,
    projectId: string,
    search?: string,
  ): Promise<InviteCandidate[]> {
    await this.assertCanManage(caller, projectId);

    const users = await this.prisma.user.findMany({
      where: {
        organizationId: caller.organizationId,
        role: { in: [Role.PROJECT_MANAGER, Role.COLLABORATOR] },
        status: 'ACTIVE',
        memberships: { none: { projectId } },
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return users;
  }

  // Read access: Owner (any in org), owning PM, or a member. Else 404.
  private async assertCanRead(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ProjectAccess> {
    const project = await this.loadProject(caller, projectId);

    if (caller.role === Role.OWNER) return project;
    if (caller.role === Role.ADMIN) throw notFound();
    if (project.managerId === caller.userId) return project;

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: caller.userId },
      },
      select: { id: true },
    });
    if (!membership) throw notFound();
    return project;
  }

  // Manage access: owning PM or Owner only. Others get 404 (hide existence).
  private async assertCanManage(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ProjectAccess> {
    const project = await this.loadProject(caller, projectId);

    if (caller.role === Role.OWNER) return project;
    if (
      caller.role === Role.PROJECT_MANAGER &&
      project.managerId === caller.userId
    ) {
      return project;
    }
    throw notFound();
  }

  private async loadProject(
    caller: CurrentUserPayload,
    projectId: string,
  ): Promise<ProjectAccess> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: caller.organizationId },
      select: { id: true, managerId: true, status: true },
    });
    if (!project) throw notFound();
    return project;
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Project was not found.',
  });
}
