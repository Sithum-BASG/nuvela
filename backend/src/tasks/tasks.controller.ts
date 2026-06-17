import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AddAssigneeDto } from './dto/add-assignee.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ColumnRow, TaskRow, TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── Columns ───────────────────────────────────────────────────────────────

  @Get('projects/:projectId/columns')
  @ApiOperation({ summary: 'List board columns for a project (any member).' })
  @ApiOkResponse({ description: 'Columns ordered by position.' })
  listColumns(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ): Promise<ColumnRow[]> {
    return this.tasksService.listColumns(user, projectId);
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  @Get('projects/:projectId/tasks')
  @ApiOperation({ summary: 'List all tasks for a project (any member).' })
  @ApiOkResponse({ description: 'Tasks ordered by column then position.' })
  listTasks(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ): Promise<TaskRow[]> {
    return this.tasksService.listTasks(user, projectId);
  }

  @Post('projects/:projectId/tasks')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a task in a project (PM/Owner only).' })
  @ApiCreatedResponse({ description: 'Created task.' })
  createTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskRow> {
    return this.tasksService.createTask(user, projectId, dto);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get a single task (any project member).' })
  @ApiOkResponse({ description: 'Task.' })
  getTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') taskId: string,
  ): Promise<TaskRow> {
    return this.tasksService.getTask(user, taskId);
  }

  @Patch('tasks/:id')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({ summary: 'Update restricted task fields (PM/Owner only).' })
  @ApiOkResponse({ description: 'Updated task.' })
  updateTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskRow> {
    return this.tasksService.updateTask(user, taskId, dto);
  }

  @Delete('tasks/:id')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a task (PM/Owner only).' })
  @ApiNoContentResponse({ description: 'Task deleted.' })
  async deleteTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') taskId: string,
  ): Promise<void> {
    await this.tasksService.deleteTask(user, taskId);
  }

  // NOTE: No @Roles on move — a Collaborator-assignee may move within
  // non-gated columns. Full gating logic lives in the service.
  @Patch('tasks/:id/move')
  @ApiOperation({ summary: 'Move a task to a column/position.' })
  @ApiOkResponse({ description: 'Task after move.' })
  moveTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') taskId: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskRow> {
    return this.tasksService.moveTask(user, taskId, dto);
  }

  // ─── Assignees ─────────────────────────────────────────────────────────────

  @Post('tasks/:id/assignees')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Add an assignee to a task (PM/Owner only).' })
  @ApiCreatedResponse({ description: 'Task with updated assignees.' })
  addAssignee(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') taskId: string,
    @Body() dto: AddAssigneeDto,
  ): Promise<TaskRow> {
    return this.tasksService.addAssignee(user, taskId, dto);
  }

  @Delete('tasks/:id/assignees/:userId')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an assignee from a task (PM/Owner only).' })
  @ApiNoContentResponse({ description: 'Assignee removed.' })
  async removeAssignee(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') taskId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.tasksService.removeAssignee(user, taskId, userId);
  }
}
