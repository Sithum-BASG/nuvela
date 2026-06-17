import {
  Body,
  Controller,
  Delete,
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
import { ChecklistService, ChecklistItemRow } from './checklist.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@ApiTags('checklist')
@ApiBearerAuth()
@Controller()
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post('tasks/:taskId/checklist')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a checklist item to a task (PM/Owner only).' })
  @ApiCreatedResponse({ description: 'Created checklist item.' })
  addItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemRow> {
    return this.checklistService.addItem(user, taskId, dto);
  }

  // NOTE: No @Roles — field-level permission check in the service:
  // text edit = PM/Owner; isChecked toggle = assignees + PM/Owner.
  @Patch('checklist/:id')
  @ApiOperation({
    summary: 'Update a checklist item (field-level permissions).',
  })
  @ApiOkResponse({ description: 'Updated checklist item.' })
  updateItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemRow> {
    return this.checklistService.updateItem(user, itemId, dto);
  }

  @Delete('checklist/:id')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a checklist item (PM/Owner only).' })
  @ApiNoContentResponse({ description: 'Checklist item deleted.' })
  async deleteItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') itemId: string,
  ): Promise<void> {
    await this.checklistService.deleteItem(user, itemId);
  }
}
