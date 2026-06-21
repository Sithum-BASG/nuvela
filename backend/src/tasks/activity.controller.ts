import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { ActivityService, type ActivityRow } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('tasks/:taskId/activity')
  @ApiOperation({ summary: 'List activity for a task (any member).' })
  @ApiOkResponse({ description: 'Activity rows newest first.' })
  getActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<ActivityRow[]> {
    return this.activityService.getActivity(user, taskId);
  }
}
