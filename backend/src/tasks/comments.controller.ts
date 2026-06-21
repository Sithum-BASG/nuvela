import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { CommentsService, type CommentRow } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('tasks/:taskId/comments')
  @ApiOperation({ summary: 'List comments for a task (any member).' })
  @ApiOkResponse({ description: 'Comments ordered oldest first.' })
  listComments(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<CommentRow[]> {
    return this.commentsService.listComments(user, taskId);
  }

  @Post('tasks/:taskId/comments')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a comment on a task (any member).' })
  @ApiCreatedResponse({ description: 'Created comment.' })
  createComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentRow> {
    return this.commentsService.createComment(user, taskId, dto);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a comment (author, owning PM, or Owner).',
  })
  @ApiNoContentResponse({ description: 'Comment deleted.' })
  async deleteComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') commentId: string,
  ): Promise<void> {
    await this.commentsService.deleteComment(user, commentId);
  }
}
