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
import { AddAdminDto } from './dto/add-admin.dto';
import { RenameOrgDto } from './dto/rename-org.dto';
import { OrganizationsService, UserRow } from './organizations.service';

@ApiTags('organization')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Patch()
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Rename the current organization.' })
  @ApiOkResponse({
    description: 'Updated organization.',
    schema: { example: { id: 'org-id', name: 'Nuvela Studio' } },
  })
  renameOrg(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RenameOrgDto,
  ): Promise<{ id: string; name: string }> {
    return this.organizationsService.renameOrg(user.organizationId, dto.name);
  }

  @Post('admins')
  @Roles(Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Promote an organization user to Admin.' })
  @ApiCreatedResponse({
    description: 'User promoted to Admin.',
    schema: { example: userRowExample() },
  })
  addAdmin(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddAdminDto,
  ): Promise<UserRow> {
    return this.organizationsService.addAdmin(user.organizationId, dto.userId);
  }

  @Delete('admins/:id')
  @Roles(Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Demote an Admin to Collaborator.' })
  @ApiOkResponse({ description: 'Admin removed.' })
  async removeAdmin(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
  ): Promise<void> {
    await this.organizationsService.removeAdmin(user.organizationId, userId);
  }
}

function userRowExample() {
  return {
    id: 'user-id',
    name: 'Maya Fernando',
    email: 'maya@example.com',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    createdAt: '2026-06-16T00:00:00.000Z',
  };
}
