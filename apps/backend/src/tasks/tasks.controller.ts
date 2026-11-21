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
import { ProjectCtx } from '../common/decorators/project-ctx.decorator';
import { ProjectRoles } from '../common/decorators/project-roles.decorator';
import {
  ProjectAccessGuard,
  ProjectRequestContext,
} from '../common/guards/project-access.guard';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateLabelDto } from './dto/create-label.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@UseGuards(ProjectAccessGuard)
@Controller('projects/:projectId')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('tasks')
  async listTasks(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const tasks = await this.tasksService.findAllByProject(projectId);
    return { tasks };
  }

  @ProjectRoles(ProjectRole.LEADER, ProjectRole.MEMBER)
  @Post('tasks')
  async createTask(
    @ProjectCtx() projectCtx: ProjectRequestContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    const task = await this.tasksService.create(projectCtx, user, dto);
    return { task };
  }

  @Get('tasks/:taskId')
  async getTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    const task = await this.tasksService.findOne(projectId, taskId);
    return { task };
  }

  @ProjectRoles(ProjectRole.LEADER, ProjectRole.MEMBER)
  @Patch('tasks/:taskId')
  async updateTask(
    @ProjectCtx() projectCtx: ProjectRequestContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const task = await this.tasksService.update(projectCtx, user, taskId, dto);
    return { task };
  }

  @ProjectRoles(ProjectRole.LEADER, ProjectRole.MEMBER)
  @Patch('tasks/:taskId/status')
  async updateTaskStatus(
    @ProjectCtx() projectCtx: ProjectRequestContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    const task = await this.tasksService.updateStatus(
      projectCtx,
      user,
      taskId,
      dto,
    );
    return { task };
  }

  @ProjectRoles(ProjectRole.LEADER, ProjectRole.MEMBER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('tasks/:taskId')
  async removeTask(
    @ProjectCtx() projectCtx: ProjectRequestContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    await this.tasksService.remove(projectCtx, user, taskId);
  }

  // Метки проекта
  @Get('labels')
  async listLabels(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const labels = await this.tasksService.listLabels(projectId);
    return { labels };
  }

  @ProjectRoles(ProjectRole.LEADER)
  @Post('labels')
  async createLabel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateLabelDto,
  ) {
    const label = await this.tasksService.createLabel(projectId, dto);
    return { label };
  }

  @ProjectRoles(ProjectRole.LEADER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('labels/:labelId')
  async removeLabel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    await this.tasksService.removeLabel(projectId, labelId);
  }
}
