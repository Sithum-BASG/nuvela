import {
  Body,
  Controller,
  Get,
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
import { Role } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { TransferProjectDto } from './dto/transfer-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectRow, ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's accessible active projects." })
  @ApiOkResponse({ description: 'Accessible active projects.' })
  listProjects(@CurrentUser() user: CurrentUserPayload): Promise<ProjectRow[]> {
    return this.projectsService.listProjects(user);
  }

  @Get('archived')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({ summary: 'List archived projects (read-only).' })
  @ApiOkResponse({ description: 'Archived projects.' })
  listArchivedProjects(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProjectRow[]> {
    return this.projectsService.listArchivedProjects(user);
  }

  @Post()
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a project and seed its four columns.' })
  @ApiCreatedResponse({ description: 'Created project.' })
  createProject(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectRow> {
    return this.projectsService.createProject(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project the caller can access.' })
  @ApiOkResponse({ description: 'Project.' })
  getProject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') projectId: string,
  ): Promise<ProjectRow> {
    return this.projectsService.getProject(user, projectId);
  }

  @Patch(':id')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @ApiOperation({ summary: 'Update a project (owning PM or Owner only).' })
  @ApiOkResponse({ description: 'Updated project.' })
  updateProject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectRow> {
    return this.projectsService.updateProject(user, projectId, dto);
  }

  @Post(':id/archive')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Archive a project (read-only thereafter).' })
  @ApiOkResponse({ description: 'Project archived.' })
  async archiveProject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') projectId: string,
  ): Promise<void> {
    await this.projectsService.archiveProject(user, projectId);
  }

  @Post(':id/unarchive')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(204)
  @ApiOperation({ summary: 'Restore an archived project to active.' })
  @ApiOkResponse({ description: 'Project unarchived.' })
  async unarchiveProject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') projectId: string,
  ): Promise<void> {
    await this.projectsService.unarchiveProject(user, projectId);
  }

  @Post(':id/transfer')
  @Roles(Role.PROJECT_MANAGER, Role.OWNER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Transfer a project to another PM or Owner.' })
  @ApiOkResponse({ description: 'Transferred project.' })
  transferProject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') projectId: string,
    @Body() dto: TransferProjectDto,
  ): Promise<ProjectRow> {
    return this.projectsService.transferProject(user, projectId, dto);
  }
}
