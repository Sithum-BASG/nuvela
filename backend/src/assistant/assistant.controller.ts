import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { AssistantActionService } from './assistant-action.service';
import { ConfirmCreateTaskDto } from './dto/confirm-create-task.dto';
import { ConfirmPostCommentDto } from './dto/confirm-post-comment.dto';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly actionService: AssistantActionService) {}

  @Post('actions/create-task')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Confirm an assistant-proposed task creation.',
  })
  @ApiCreatedResponse({ description: 'Created task.' })
  confirmCreateTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmCreateTaskDto,
  ) {
    return this.actionService.confirmCreateTask(user, dto);
  }

  @Post('actions/post-comment')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Confirm an assistant-proposed comment.',
  })
  @ApiCreatedResponse({ description: 'Created comment.' })
  confirmPostComment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmPostCommentDto,
  ) {
    return this.actionService.confirmPostComment(user, dto);
  }
}
