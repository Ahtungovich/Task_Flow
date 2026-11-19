import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-roles.decorator';
import { RequireVerifiedTeacher } from '../common/decorators/require-verified-teacher.decorator';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @RequireVerifiedTeacher()
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectsService.create(user.id, dto);
    return { project };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const projects = await this.projectsService.findAllForUser(user.id);
    return { projects };
  }

  @UseGuards(ProjectAccessGuard)
  @Get(':projectId')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const project = await this.projectsService.findOne(projectId, user.id);
    return { project };
  }

  @UseGuards(ProjectAccessGuard)
  @ProjectRoles(ProjectRole.LEADER)
  @Patch(':projectId')
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.update(projectId, dto);
    return { project };
  }

  @UseGuards(ProjectAccessGuard)
  @ProjectRoles(ProjectRole.LEADER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':projectId')
  async remove(@Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.projectsService.remove(projectId);
  }

  @UseGuards(ProjectAccessGuard)
  @Get(':projectId/members')
  async listMembers(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const members = await this.projectsService.listMembers(projectId);
    return { members };
  }

  @UseGuards(ProjectAccessGuard)
  @ProjectRoles(ProjectRole.LEADER)
  @Post(':projectId/members')
  async addMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    const member = await this.projectsService.addMember(projectId, dto);
    return { member };
  }

  @UseGuards(ProjectAccessGuard)
  @ProjectRoles(ProjectRole.LEADER)
  @Patch(':projectId/members/:userId')
  async updateMemberRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const member = await this.projectsService.updateMemberRole(
      projectId,
      userId,
      dto,
    );
    return { member };
  }

  @UseGuards(ProjectAccessGuard)
  @ProjectRoles(ProjectRole.LEADER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':projectId/members/:userId')
  async removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.projectsService.removeMember(projectId, userId);
  }
}
