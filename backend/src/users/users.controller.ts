import {
  Body,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRow, UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'List organization users.' })
  @ApiOkResponse({
    description: 'Organization users.',
    schema: { example: [userRowExample()] },
  })
  listUsers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: { role?: Role; status?: UserStatus; search?: string },
  ): Promise<UserRow[]> {
    return this.usersService.listUsers(user.organizationId, query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create an invited Project Manager or Collaborator.',
  })
  @ApiCreatedResponse({
    description: 'User created and temporary password email sent.',
    schema: { example: userRowExample() },
  })
  createUser(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateUserDto,
  ): Promise<UserRow> {
    return this.usersService.createUser(user.organizationId, user.role, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Update a user in the current organization.' })
  @ApiOkResponse({
    description: 'Updated user.',
    schema: { example: userRowExample() },
  })
  updateUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserRow> {
    return this.usersService.updateUser(
      user.organizationId,
      userId,
      user.role,
      dto,
    );
  }

  @Post(':id/deactivate')
  @Roles(Role.ADMIN, Role.OWNER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a user without hard-deleting them.' })
  @ApiOkResponse({
    description:
      'User deactivated, or active PM-owned projects returned for transfer.',
    schema: {
      examples: {
        done: { value: { done: true } },
        transfersRequired: {
          value: {
            done: false,
            projects: [{ id: 'project-id', name: 'Website Redesign' }],
          },
        },
      },
    },
  })
  deactivateUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
    @Body() dto: DeactivateUserDto,
  ): Promise<{ done: boolean; projects?: { id: string; name: string }[] }> {
    return this.usersService.deactivateUser(user.organizationId, userId, dto);
  }

  @Post(':id/resend-invite')
  @Roles(Role.ADMIN, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Regenerate and resend a temporary password.' })
  @ApiOkResponse({ description: 'Invite resent.' })
  async resendInvite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
  ): Promise<void> {
    await this.usersService.resendInvite(user.organizationId, userId);
  }
}

function userRowExample() {
  return {
    id: 'user-id',
    name: 'Maya Fernando',
    email: 'maya@example.com',
    role: Role.PROJECT_MANAGER,
    status: UserStatus.PENDING,
    createdAt: '2026-06-16T00:00:00.000Z',
  };
}
