import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    TasksController,
    LabelsController,
    ChecklistController,
    CommentsController,
  ],
  providers: [TasksService, LabelsService, ChecklistService, CommentsService],
  exports: [TasksService],
})
export class TasksModule {}
