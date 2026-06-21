import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [
    TasksController,
    LabelsController,
    ChecklistController,
    CommentsController,
    AttachmentsController,
  ],
  providers: [
    TasksService,
    LabelsService,
    ChecklistService,
    CommentsService,
    AttachmentsService,
  ],
  exports: [TasksService],
})
export class TasksModule {}
