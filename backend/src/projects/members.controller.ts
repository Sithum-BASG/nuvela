import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { InviteCandidate, MemberRow, MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List the members of a project.' })
  @ApiOkResponse({ description: 'Project members.' })
  listMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ): Promise<MemberRow[]> {
    return this.membersService.listMembers(user, projectId);
  }

  @Get('invite-directory')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({
    summary: 'List org users eligible to invite to the project.',
  })
  @ApiOkResponse({ description: 'Invite candidates.' })
  listInviteCandidates(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Query('search') search?: string,
  ): Promise<InviteCandidate[]> {
    return this.membersService.listInviteCandidates(user, projectId, search);
  }

  @Post()
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({ summary: 'Invite an existing org user to the project.' })
  @ApiCreatedResponse({ description: 'Member added.' })
  addMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: AddMemberDto,
  ): Promise<MemberRow> {
    return this.membersService.addMember(user, projectId, dto.userId);
  }

  @Delete(':userId')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({
    summary: "Remove a member; reassign or unassign the member's tasks first.",
  })
  @ApiOkResponse({
    description: 'Member removed, or 409 with the tasks needing reassignment.',
  })
  removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: RemoveMemberDto,
  ): Promise<{ assignedTasks: { id: string; title: string }[] }> {
    return this.membersService.removeMember(user, projectId, userId, dto);
  }
}
