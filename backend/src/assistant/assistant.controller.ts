import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { AssistantActionService } from './assistant-action.service';
import { AssistantService } from './assistant.service';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { ConfirmCreateTaskDto } from './dto/confirm-create-task.dto';
import { ConfirmPostCommentDto } from './dto/confirm-post-comment.dto';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly actionService: AssistantActionService,
    private readonly assistantService: AssistantService,
  ) {}

  @Post('chat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stream an assistant response as NDJSON.' })
  @ApiOkResponse({ description: 'NDJSON stream of assistant events.' })
  async chat(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AssistantChatDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.assistantService.streamChat(user, dto, response);
  }

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
