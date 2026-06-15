import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('../auth/password.util', () => ({
  generateTempPassword: jest.fn(() => 'TempPass1'),
  hashPassword: jest.fn((password: string) =>
    Promise.resolve(`hashed-${password}`),
  ),
}));

type MockPrisma = {
  user: {
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  project: {
    findMany: jest.Mock;
  };
  taskAssignee: {
    deleteMany: jest.Mock;
  };
};

describe('UsersService', () => {
  let prisma: MockPrisma;
  let mailService: { sendTempPasswordEmail: jest.Mock };
  let service: UsersService;

  const createdAt = new Date('2026-06-16T00:00:00.000Z');
  const userRow = {
    id: 'user-1',
    name: 'Maya Fernando',
    email: 'maya@example.com',
    role: Role.PROJECT_MANAGER,
    status: UserStatus.PENDING,
    createdAt,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
      },
      taskAssignee: {
        deleteMany: jest.fn(),
      },
    };
    mailService = {
      sendTempPasswordEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
    );
  });

  it('rejects createUser with OWNER role', async () => {
    await expect(
      service.createUser('org-1', Role.OWNER, {
        name: 'Owner',
        email: 'owner@example.com',
        role: Role.OWNER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CANNOT_CREATE_ROLE',
        message: 'Cannot create users with this role here.',
      },
    });
  });

  it('rejects createUser with ADMIN role', async () => {
    await expect(
      service.createUser('org-1', Role.OWNER, {
        name: 'Admin',
        email: 'admin@example.com',
        role: Role.ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a PROJECT_MANAGER user and emails a temporary password', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(userRow);

    const result = await service.createUser('org-1', Role.ADMIN, {
      name: userRow.name,
      email: userRow.email,
      role: Role.PROJECT_MANAGER,
    });

    expect(result).toEqual(userRow);
    expect(prisma.user.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        organizationId: 'org-1',
        name: userRow.name,
        email: userRow.email,
        passwordHash: 'hashed-TempPass1',
        role: Role.PROJECT_MANAGER,
        status: UserStatus.PENDING,
        mustResetPassword: true,
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      select: expect.any(Object),
    });
    expect(mailService.sendTempPasswordEmail).toHaveBeenCalledWith(
      userRow.email,
      'TempPass1',
      'http://localhost:3000/login',
    );
  });

  it('rejects createUser when email already exists in the organization', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.createUser('org-1', Role.ADMIN, {
        name: userRow.name,
        email: userRow.email,
        role: Role.COLLABORATOR,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_EXISTS',
        message: 'A user with this email already exists in the organization.',
      },
    });
  });

  it('rejects deactivateUser for OWNER users', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.OWNER,
    });

    await expect(
      service.deactivateUser('org-1', 'user-1'),
    ).rejects.toMatchObject({
      response: { code: 'CANNOT_DEACTIVATE_OWNER' },
    });
  });

  it('returns owned projects when deactivating a PROJECT_MANAGER with active projects', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.PROJECT_MANAGER,
    });
    prisma.project.findMany.mockResolvedValue([
      { id: 'project-1', name: 'Website Redesign' },
    ]);

    await expect(service.deactivateUser('org-1', 'user-1')).resolves.toEqual({
      done: false,
      projects: [{ id: 'project-1', name: 'Website Redesign' }],
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.taskAssignee.deleteMany).not.toHaveBeenCalled();
  });

  it('deactivates a PROJECT_MANAGER with no owned projects and unassigns tasks', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.PROJECT_MANAGER,
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.taskAssignee.deleteMany.mockResolvedValue({ count: 2 });
    prisma.user.update.mockResolvedValue({
      ...userRow,
      status: UserStatus.DEACTIVATED,
    });

    await expect(service.deactivateUser('org-1', 'user-1')).resolves.toEqual({
      done: true,
    });
    expect(prisma.taskAssignee.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', task: { organizationId: 'org-1' } },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: UserStatus.DEACTIVATED },
    });
  });

  it('deactivates a COLLABORATOR and unassigns tasks', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.COLLABORATOR,
    });
    prisma.taskAssignee.deleteMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({
      ...userRow,
      status: UserStatus.DEACTIVATED,
    });

    await expect(service.deactivateUser('org-1', 'user-1')).resolves.toEqual({
      done: true,
    });
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.taskAssignee.deleteMany).toHaveBeenCalled();
  });

  it('rejects updateUser setting ADMIN role when actor is ADMIN', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(userRow);

    await expect(
      service.updateUser('org-1', 'user-1', Role.ADMIN, {
        role: Role.ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects updateUser setting OWNER role', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(userRow);

    await expect(
      service.updateUser('org-1', 'user-1', Role.OWNER, {
        role: Role.OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps missing users to NotFoundException', async () => {
    prisma.user.findFirstOrThrow.mockRejectedValue(new Error('not found'));

    await expect(
      service.updateUser('org-1', 'missing-user', Role.OWNER, {
        name: 'New Name',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resends an invite by updating credentials and emailing the temp password', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(userRow);
    prisma.user.update.mockResolvedValue({
      ...userRow,
      status: UserStatus.PENDING,
    });

    await service.resendInvite('org-1', 'user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        passwordHash: 'hashed-TempPass1',
        mustResetPassword: true,
        status: UserStatus.PENDING,
      }),
    });
    expect(mailService.sendTempPasswordEmail).toHaveBeenCalledWith(
      userRow.email,
      'TempPass1',
      'http://localhost:3000/login',
    );
  });
});
