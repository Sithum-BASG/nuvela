import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import {
  DashboardService,
  type MyWorkResult,
  type OrgOverview,
} from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('my-work')
  @Roles(Role.OWNER, Role.PROJECT_MANAGER, Role.COLLABORATOR)
  @ApiOperation({
    summary:
      'Assigned tasks and accessible project progress for PM/Collaborator (Owner may also call).',
  })
  @ApiOkResponse({ description: 'My-work dashboard aggregates.' })
  myWork(@CurrentUser() user: CurrentUserPayload): Promise<MyWorkResult> {
    return this.dashboardService.myWork(user);
  }

  @Get('org-overview')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Organization overview: user counts, pending invites, projects, recent users.',
  })
  @ApiOkResponse({ description: 'Org-overview dashboard aggregates.' })
  orgOverview(@CurrentUser() user: CurrentUserPayload): Promise<OrgOverview> {
    return this.dashboardService.orgOverview(user);
  }
}
