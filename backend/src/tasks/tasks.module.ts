import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
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
    ActivityController,
  ],
  providers: [
    TasksService,
    LabelsService,
    ChecklistService,
    CommentsService,
    AttachmentsService,
    ActivityService,
  ],
  exports: [TasksService],
})
export class TasksModule {}
