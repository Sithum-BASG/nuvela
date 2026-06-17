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
import { ApplyLabelDto } from './dto/apply-label.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService } from './labels.service';
import type { LabelRow } from './tasks.service';

@ApiTags('labels')
@ApiBearerAuth()
@Controller()
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get('projects/:projectId/labels')
  @ApiOperation({ summary: 'List labels for a project (any member).' })
  @ApiOkResponse({ description: 'Labels ordered by name.' })
  listLabels(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ): Promise<LabelRow[]> {
    return this.labelsService.listLabels(user, projectId);
  }

  @Post('projects/:projectId/labels')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a label for a project (PM/Owner only).' })
  @ApiCreatedResponse({ description: 'Created label.' })
  createLabel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateLabelDto,
  ): Promise<LabelRow> {
    return this.labelsService.createLabel(user, projectId, dto);
  }

  @Patch('labels/:id')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({ summary: 'Update a label (PM/Owner only).' })
  @ApiOkResponse({ description: 'Updated label.' })
  updateLabel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') labelId: string,
    @Body() dto: UpdateLabelDto,
  ): Promise<LabelRow> {
    return this.labelsService.updateLabel(user, labelId, dto);
  }

  @Delete('labels/:id')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a label (PM/Owner only).' })
  @ApiNoContentResponse({ description: 'Label deleted.' })
  async deleteLabel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') labelId: string,
  ): Promise<void> {
    await this.labelsService.deleteLabel(user, labelId);
  }

  @Post('tasks/:taskId/labels')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Apply a label to a task (PM/Owner only).' })
  @ApiCreatedResponse({ description: 'Label applied.' })
  async applyLabel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: ApplyLabelDto,
  ): Promise<void> {
    await this.labelsService.applyLabel(user, taskId, dto);
  }

  @Delete('tasks/:taskId/labels/:labelId')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a label from a task (PM/Owner only).' })
  @ApiNoContentResponse({ description: 'Label removed.' })
  async removeLabel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
  ): Promise<void> {
    await this.labelsService.removeLabel(user, taskId, labelId);
  }
}
