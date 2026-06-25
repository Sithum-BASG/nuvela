import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { AssistantActionParser } from './assistant-action.parser';
import { AssistantActionService } from './assistant-action.service';
import { AssistantContextBuilder } from './assistant-context.builder';
import { AssistantController } from './assistant.controller';
import { AssistantModelClient } from './assistant-model.client';
import { AssistantService } from './assistant.service';

@Module({
  imports: [PrismaModule, TasksModule],
  controllers: [AssistantController],
  providers: [
    AssistantActionParser,
    AssistantActionService,
    AssistantService,
    AssistantContextBuilder,
    AssistantModelClient,
  ],
})
export class AssistantModule {}
