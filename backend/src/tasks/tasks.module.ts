import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController, LabelsController, ChecklistController],
  providers: [TasksService, LabelsService, ChecklistService],
  exports: [TasksService],
})
export class TasksModule {}
