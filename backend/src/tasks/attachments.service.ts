import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, ProjectStatus, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TasksService } from './tasks.service';

export type AttachmentRow = {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
};

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly storageService: StorageService,
  ) {}

  async listAttachments(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<AttachmentRow[]> {
    await this.loadTaskForRead(caller, taskId);

    const rows = await this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        taskId: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return rows;
  }

  async createAttachment(
    caller: CurrentUserPayload,
    taskId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ): Promise<AttachmentRow> {
    const task = await this.loadTaskForRead(caller, taskId);
    const project = await this.tasksService.findAccessibleProject(
      caller,
      task.projectId,
    );
    this.assertNotArchived(project.status);

    if (file.size > MAX_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Max 10 MB.',
      });
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_TYPE',
        message: 'Unsupported file type.',
      });
    }

    const attachmentId = randomUUID();
    const objectPath = `${caller.organizationId}/${task.projectId}/${taskId}/${attachmentId}-${sanitize(file.originalname)}`;

    await this.storageService.upload(objectPath, file.buffer, file.mimetype);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          id: attachmentId,
          taskId,
          uploadedById: caller.userId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: objectPath,
        },
        select: {
          id: true,
          taskId: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          taskId,
          actorId: caller.userId,
          type: ActivityType.ATTACHMENT_ADDED,
          metadata: { attachmentId, fileName: file.originalname },
        },
      });

      return created;
    });

    return row;
  }

  async getSignedUrl(
    caller: CurrentUserPayload,
    attachmentId: string,
  ): Promise<{ url: string }> {
    const attachment = await this.loadAttachmentForRead(caller, attachmentId);
    const url = await this.storageService.createSignedUrl(
      attachment.storageKey,
      300,
    );
    return { url };
  }

  async deleteAttachment(
    caller: CurrentUserPayload,
    attachmentId: string,
  ): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        task: { organizationId: caller.organizationId },
      },
      select: {
        id: true,
        storageKey: true,
        uploadedById: true,
        task: {
          select: {
            project: { select: { managerId: true } },
          },
        },
      },
    });
    if (!attachment) throw notFound();

    const isUploader = attachment.uploadedById === caller.userId;
    const isOwner = caller.role === Role.OWNER;
    const isOwningPm =
      caller.role === Role.PROJECT_MANAGER &&
      attachment.task.project.managerId === caller.userId;

    if (!isUploader && !isOwner && !isOwningPm) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You may only delete your own attachments.',
      });
    }

    await this.storageService.remove(attachment.storageKey);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
  }

  private async loadTaskForRead(
    caller: CurrentUserPayload,
    taskId: string,
  ): Promise<{ id: string; projectId: string }> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: caller.organizationId },
      select: { id: true, projectId: true },
    });
    if (!task) throw notFound();

    await this.tasksService.findAccessibleProject(caller, task.projectId);
    return task;
  }

  private async loadAttachmentForRead(
    caller: CurrentUserPayload,
    attachmentId: string,
  ): Promise<{ storageKey: string; task: { projectId: string } }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        task: { organizationId: caller.organizationId },
      },
      select: {
        storageKey: true,
        task: { select: { projectId: true } },
      },
    });
    if (!attachment) throw notFound();

    await this.tasksService.findAccessibleProject(
      caller,
      attachment.task.projectId,
    );
    return attachment;
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

function sanitize(fileName: string): string {
  return fileName.replace(/[^A-Za-z0-9._-]/g, '_');
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Resource was not found.',
  });
}
