import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AttachmentsService } from './attachments.service';
import { TasksService } from './tasks.service';

type MockPrisma = {
  project: { findFirst: jest.Mock };
  projectMember: { findUnique: jest.Mock };
  task: { findFirst: jest.Mock };
  attachment: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  activityLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

const member: CurrentUserPayload = {
  userId: 'member-1',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

const otherMember: CurrentUserPayload = {
  userId: 'member-2',
  role: Role.COLLABORATOR,
  organizationId: 'org-1',
};

const pm: CurrentUserPayload = {
  userId: 'pm-1',
  role: Role.PROJECT_MANAGER,
  organizationId: 'org-1',
};

const admin: CurrentUserPayload = {
  userId: 'admin-1',
  role: Role.ADMIN,
  organizationId: 'org-1',
};

function projectRecord() {
  return {
    id: 'project-1',
    status: ProjectStatus.ACTIVE,
    managerId: 'pm-1',
    organizationId: 'org-1',
  };
}

function taskRecord() {
  return { id: 'task-1', projectId: 'project-1', organizationId: 'org-1' };
}

function validFile() {
  return {
    originalname: 'doc.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('pdf'),
  };
}

describe('AttachmentsService', () => {
  let prisma: MockPrisma;
  let tasksService: TasksService;
  let storageService: jest.Mocked<
    Pick<StorageService, 'upload' | 'createSignedUrl' | 'remove'>
  >;
  let service: AttachmentsService;

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      task: { findFirst: jest.fn() },
      attachment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      activityLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    storageService = {
      upload: jest.fn().mockResolvedValue(undefined),
      createSignedUrl: jest
        .fn()
        .mockResolvedValue('https://example.com/signed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    tasksService = new TasksService(prisma as unknown as PrismaService);
    service = new AttachmentsService(
      prisma as unknown as PrismaService,
      tasksService,
      storageService as unknown as StorageService,
    );
  });

  function mockMemberAccess(userId = member.userId) {
    prisma.task.findFirst.mockResolvedValue(taskRecord());
    prisma.project.findFirst.mockResolvedValue(projectRecord());
    if (userId !== pm.userId) {
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });
    } else {
      prisma.projectMember.findUnique.mockResolvedValue(null);
    }
  }

  describe('createAttachment', () => {
    it('allows member upload and writes ATTACHMENT_ADDED', async () => {
      mockMemberAccess();
      prisma.attachment.create.mockResolvedValue({
        id: 'att-1',
        taskId: 'task-1',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        createdAt: new Date(),
        uploadedBy: { id: 'member-1', name: 'Member' },
      });
      prisma.activityLog.create.mockResolvedValue({});

      const result = await service.createAttachment(
        member,
        'task-1',
        validFile(),
      );

      expect(result.id).toBe('att-1');
      expect(storageService.upload).toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            type: ActivityType.ATTACHMENT_ADDED,
          }),
        }),
      );
    });

    it('rejects oversize files without uploading', async () => {
      mockMemberAccess();
      await expect(
        service.createAttachment(member, 'task-1', {
          ...validFile(),
          size: 11 * 1024 * 1024,
        }),
      ).rejects.toMatchObject({ response: { code: 'FILE_TOO_LARGE' } });
      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('rejects disallowed mime without uploading', async () => {
      mockMemberAccess();
      await expect(
        service.createAttachment(member, 'task-1', {
          ...validFile(),
          mimetype: 'application/x-msdownload',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storageService.upload).not.toHaveBeenCalled();
    });
  });

  describe('getSignedUrl', () => {
    it('returns signed url for member', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        storageKey: 'org-1/project-1/task-1/att-1-doc.pdf',
        task: { projectId: 'project-1' },
      });
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'm-1' });

      const result = await service.getSignedUrl(member, 'att-1');
      expect(result.url).toBe('https://example.com/signed');
      expect(storageService.createSignedUrl).toHaveBeenCalledWith(
        'org-1/project-1/task-1/att-1-doc.pdf',
        300,
      );
    });

    it('throws NotFound for non-member', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        storageKey: 'key',
        task: { projectId: 'project-1' },
      });
      prisma.project.findFirst.mockResolvedValue(projectRecord());
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getSignedUrl(otherMember, 'att-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound for ADMIN', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        storageKey: 'key',
        task: { projectId: 'project-1' },
      });
      prisma.project.findFirst.mockResolvedValue(projectRecord());

      await expect(service.getSignedUrl(admin, 'att-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteAttachment', () => {
    it('allows uploader to delete', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        storageKey: 'key',
        uploadedById: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });
      prisma.attachment.delete.mockResolvedValue({});

      await expect(
        service.deleteAttachment(member, 'att-1'),
      ).resolves.toBeUndefined();
      expect(storageService.remove).toHaveBeenCalledWith('key');
    });

    it('forbids another plain member', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        storageKey: 'key',
        uploadedById: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });

      await expect(
        service.deleteAttachment(otherMember, 'att-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows owning PM to delete', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        storageKey: 'key',
        uploadedById: 'member-1',
        task: { project: { managerId: 'pm-1' } },
      });
      prisma.attachment.delete.mockResolvedValue({});

      await expect(
        service.deleteAttachment(pm, 'att-1'),
      ).resolves.toBeUndefined();
    });
  });
});
