import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { NotificationRow, NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller notifications (own-only).' })
  @ApiOkResponse({
    description: 'Notifications for the authenticated user.',
    schema: { example: [notificationRowExample()] },
  })
  listNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query('unread') unread?: string,
  ): Promise<NotificationRow[]> {
    return this.notificationsService.listOwn(user, {
      unreadOnly: unread === 'true',
    });
  }

  @Patch(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark one notification as read.' })
  @ApiOkResponse({ description: 'Notification marked read.' })
  async markRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notificationsService.markRead(user, id);
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark all unread notifications as read.' })
  @ApiOkResponse({ description: 'All notifications marked read.' })
  async markAllRead(@CurrentUser() user: CurrentUserPayload): Promise<void> {
    await this.notificationsService.markAllRead(user);
  }
}

function notificationRowExample() {
  return {
    id: 'notification-id',
    type: NotificationType.TASK_ASSIGNED,
    payload: { taskId: 'task-id', projectId: 'project-id', title: 'Fix login' },
    isRead: false,
    createdAt: '2026-06-16T00:00:00.000Z',
  };
}
