import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { AttachmentsService, type AttachmentRow } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get('tasks/:taskId/attachments')
  @ApiOperation({ summary: 'List attachments for a task (any member).' })
  @ApiOkResponse({ description: 'Attachments ordered newest first.' })
  listAttachments(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<AttachmentRow[]> {
    return this.attachmentsService.listAttachments(user, taskId);
  }

  @Post('tasks/:taskId/attachments')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload an attachment to a task (any member).' })
  @ApiCreatedResponse({ description: 'Created attachment.' })
  createAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ): Promise<AttachmentRow> {
    return this.attachmentsService.createAttachment(user, taskId, file);
  }

  @Get('attachments/:id/url')
  @ApiOperation({
    summary: 'Get a short-lived signed download URL (any member).',
  })
  @ApiOkResponse({ description: 'Signed URL valid for 5 minutes.' })
  getSignedUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') attachmentId: string,
  ): Promise<{ url: string }> {
    return this.attachmentsService.getSignedUrl(user, attachmentId);
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete an attachment (uploader, owning PM, or Owner).',
  })
  @ApiNoContentResponse({ description: 'Attachment deleted.' })
  async deleteAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') attachmentId: string,
  ): Promise<void> {
    await this.attachmentsService.deleteAttachment(user, attachmentId);
  }
}
