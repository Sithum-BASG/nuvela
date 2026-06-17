import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async renameOrg(
    orgId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { name },
      select: { id: true, name: true },
    });
  }

  async addAdmin(orgId: string, userId: string): Promise<UserRow> {
    const user = await this.findUserInOrg(orgId, userId);

    if (user.role === Role.OWNER || user.role === Role.ADMIN) {
      throw new ConflictException({
        code: 'ALREADY_PRIVILEGED',
        message: 'User is already an Owner or Admin.',
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
      select: USER_ROW_SELECT,
    });
  }

  async removeAdmin(orgId: string, userId: string): Promise<void> {
    const user = await this.findUserInOrg(orgId, userId);

    if (user.role === Role.OWNER) {
      throw new ConflictException({
        code: 'CANNOT_DEMOTE_OWNER',
        message: 'Cannot demote the Owner.',
      });
    }

    if (user.role !== Role.ADMIN) {
      throw new ConflictException({
        code: 'NOT_AN_ADMIN',
        message: 'User is not an Admin.',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.COLLABORATOR },
    });
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
