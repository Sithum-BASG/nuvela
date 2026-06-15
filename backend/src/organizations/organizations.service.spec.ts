import { NotFoundException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

type MockPrisma = {
  organization: {
    update: jest.Mock;
  };
  user: {
    findFirstOrThrow: jest.Mock;
    update: jest.Mock;
  };
};

describe('OrganizationsService', () => {
  let prisma: MockPrisma;
  let service: OrganizationsService;

  const createdAt = new Date('2026-06-16T00:00:00.000Z');
  const userRow = {
    id: 'user-1',
    name: 'Maya Fernando',
    email: 'maya@example.com',
    role: Role.COLLABORATOR,
    status: UserStatus.ACTIVE,
    createdAt,
  };

  beforeEach(() => {
    prisma = {
      organization: {
        update: jest.fn(),
      },
      user: {
        findFirstOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new OrganizationsService(prisma as unknown as PrismaService);
  });

  it('promotes a COLLABORATOR to ADMIN', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(userRow);
    prisma.user.update.mockResolvedValue({ ...userRow, role: Role.ADMIN });

    await expect(service.addAdmin('org-1', 'user-1')).resolves.toEqual({
      ...userRow,
      role: Role.ADMIN,
    });
    expect(prisma.user.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-1', organizationId: 'org-1' },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      select: expect.any(Object),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: Role.ADMIN },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      select: expect.any(Object),
    });
  });

  it('rejects addAdmin for an existing ADMIN', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.ADMIN,
    });

    await expect(service.addAdmin('org-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'ALREADY_PRIVILEGED',
        message: 'User is already an Owner or Admin.',
      },
    });
  });

  it('maps missing addAdmin users to NotFoundException', async () => {
    prisma.user.findFirstOrThrow.mockRejectedValue(new Error('not found'));

    await expect(
      service.addAdmin('org-1', 'missing-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('demotes an ADMIN to COLLABORATOR', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.ADMIN,
    });
    prisma.user.update.mockResolvedValue({
      ...userRow,
      role: Role.COLLABORATOR,
    });

    await expect(
      service.removeAdmin('org-1', 'user-1'),
    ).resolves.toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: Role.COLLABORATOR },
    });
  });

  it('rejects removeAdmin for OWNER users', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue({
      ...userRow,
      role: Role.OWNER,
    });

    await expect(service.removeAdmin('org-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'CANNOT_DEMOTE_OWNER',
        message: 'Cannot demote the Owner.',
      },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects removeAdmin for a COLLABORATOR', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(userRow);

    await expect(service.removeAdmin('org-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'NOT_AN_ADMIN',
        message: 'User is not an Admin.',
      },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('renames an organization', async () => {
    prisma.organization.update.mockResolvedValue({
      id: 'org-1',
      name: 'Nuvela Studio',
    });

    await expect(service.renameOrg('org-1', 'Nuvela Studio')).resolves.toEqual({
      id: 'org-1',
      name: 'Nuvela Studio',
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { name: 'Nuvela Studio' },
      select: { id: true, name: true },
    });
  });
});
