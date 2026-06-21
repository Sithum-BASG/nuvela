import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  ProjectStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import { generateTempPassword, hashPassword } from '../auth/password.util';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

const USER_ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listUsers(
    orgId: string,
    query?: { role?: Role; status?: UserStatus; search?: string },
  ): Promise<UserRow[]> {
    return this.prisma.user.findMany({
      where: {
        organizationId: orgId,
        ...(query?.role && { role: query.role }),
        ...(query?.status && { status: query.status }),
        ...(query?.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: USER_ROW_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async createUser(
    orgId: string,
    actorRole: Role,
    dto: CreateUserDto,
  ): Promise<UserRow> {
    void actorRole;
    if (dto.role === Role.OWNER || dto.role === Role.ADMIN) {
      throw new ForbiddenException({
        code: 'CANNOT_CREATE_ROLE',
        message: 'Cannot create users with this role here.',
      });
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        organizationId: orgId,
        email: dto.email,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        message: 'A user with this email already exists in the organization.',
      });
    }

    const tempPassword = generateTempPassword();
    const user = await this.prisma.user.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        email: dto.email,
        passwordHash: await hashPassword(tempPassword),
        role: dto.role,
        status: UserStatus.PENDING,
        mustResetPassword: true,
        tempPasswordExpiresAt: inviteExpiry(),
      },
      select: USER_ROW_SELECT,
    });

    await this.mailService.sendTempPasswordEmail(
      dto.email,
      tempPassword,
      loginUrl(),
    );

    return user;
  }

  async updateUser(
    orgId: string,
    userId: string,
    actorRole: Role,
    dto: UpdateUserDto,
  ): Promise<UserRow> {
    await this.findUserInOrg(orgId, userId);

    if (dto.role === Role.OWNER) {
      throw new ForbiddenException({
        code: 'CANNOT_ASSIGN_ROLE',
        message: 'Cannot assign this role here.',
      });
    }

    if (dto.role === Role.ADMIN && actorRole === Role.ADMIN) {
      throw new ForbiddenException({
        code: 'CANNOT_ASSIGN_ADMIN',
        message: 'Only Owners can assign or change Admin role.',
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.role !== undefined && { role: dto.role }),
      },
      select: USER_ROW_SELECT,
    });
  }

  async deactivateUser(
    orgId: string,
    userId: string,
    dto: DeactivateUserDto = {},
    actorId?: string,
  ): Promise<{ done: boolean; projects?: { id: string; name: string }[] }> {
    const user = await this.findUserInOrg(orgId, userId);

    if (user.role === Role.OWNER) {
      throw new ConflictException({
        code: 'CANNOT_DEACTIVATE_OWNER',
        message: 'Cannot deactivate the organization Owner.',
      });
    }

    if (user.role === Role.PROJECT_MANAGER) {
      const ownedProjects = await this.prisma.project.findMany({
        where: {
          managerId: userId,
          organizationId: orgId,
          status: ProjectStatus.ACTIVE,
        },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });

      if (ownedProjects.length > 0) {
        const transfers = dto.transfers ?? [];
        const transferByProject = new Map(
          transfers.map((t) => [t.projectId, t.newManagerId]),
        );

        // Every owned project must have a transfer target, or the deactivation
        // is blocked and the caller is told which projects still need one.
        const allCovered = ownedProjects.every((p) =>
          transferByProject.has(p.id),
        );
        if (!allCovered) {
          return { done: false, projects: ownedProjects };
        }

        // Each new manager must be a PM or Owner in the same org.
        const targetIds = [...new Set(transferByProject.values())];
        const validTargets = await this.prisma.user.findMany({
          where: {
            id: { in: targetIds },
            organizationId: orgId,
            role: { in: [Role.PROJECT_MANAGER, Role.OWNER] },
          },
          select: { id: true },
        });
        const validTargetIds = new Set(validTargets.map((t) => t.id));
        for (const target of transferByProject.values()) {
          if (!validTargetIds.has(target) || target === userId) {
            throw new ConflictException({
              code: 'INVALID_TRANSFER_TARGET',
              message:
                'Each project must transfer to another Project Manager or Owner.',
            });
          }
        }

        await this.prisma.$transaction(async (tx) => {
          for (const project of ownedProjects) {
            const newManagerId = transferByProject.get(project.id)!;
            await tx.projectMember.upsert({
              where: {
                projectId_userId: {
                  projectId: project.id,
                  userId: newManagerId,
                },
              },
              create: { projectId: project.id, userId: newManagerId },
              update: {},
            });
            await tx.project.update({
              where: { id: project.id },
              data: { managerId: newManagerId },
            });
          }
        });

        for (const project of ownedProjects) {
          const newManagerId = transferByProject.get(project.id)!;
          if (newManagerId !== actorId) {
            await this.notificationsService.notify({
              organizationId: orgId,
              recipientId: newManagerId,
              type: NotificationType.PROJECT_TRANSFERRED,
              payload: { projectId: project.id, name: project.name },
            });
          }
        }
      }
    }

    // Soft-deactivate and auto-unassign the user's TaskAssignee rows across the
    // org (their progress work elsewhere is released; Backend Schema §lifecycle).
    await this.prisma.taskAssignee.deleteMany({
      where: { userId, task: { organizationId: orgId } },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DEACTIVATED },
    });

    return { done: true };
  }

  async resendInvite(orgId: string, userId: string): Promise<void> {
    const user = await this.findUserInOrg(orgId, userId);
    const tempPassword = generateTempPassword();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustResetPassword: true,
        tempPasswordExpiresAt: inviteExpiry(),
        status: UserStatus.PENDING,
      },
    });

    await this.mailService.sendTempPasswordEmail(
      user.email,
      tempPassword,
      loginUrl(),
    );
  }

  private async findUserInOrg(orgId: string, userId: string): Promise<UserRow> {
    try {
      return await this.prisma.user.findFirstOrThrow({
        where: { id: userId, organizationId: orgId },
        select: USER_ROW_SELECT,
      });
    } catch {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User was not found.',
      });
    }
  }
}

function inviteExpiry(): Date {
  return new Date(Date.now() + 72 * 60 * 60 * 1000);
}

function loginUrl(): string {
  // FRONTEND_URL is the base origin everywhere in the app (auth.service, main.ts);
  // append the login path here so the temp-password email links to the sign-in page.
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base}/login`;
}
