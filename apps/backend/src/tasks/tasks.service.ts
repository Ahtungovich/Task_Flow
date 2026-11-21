import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectRole,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { ProjectRequestContext } from '../common/guards/project-access.guard';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const USER_SHORT_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatar: true,
  accountType: true,
} as const;

const TASK_INCLUDE = {
  author: { select: USER_SHORT_SELECT },
  assignee: { select: USER_SHORT_SELECT },
  labels: {
    include: {
      label: true,
    },
  },
  _count: {
    select: {
      comments: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private parseOptionalDate(value?: string | null): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Некорректный формат даты.');
    }
    return parsed;
  }

  /**
   * П. 6.4 ТЗ: Просрочка не является отдельным статусом.
   * Определяется автоматически, если дедлайн прошёл и статус != DONE.
   */
  private isTaskOverdue(task: { deadline: Date | null; status: TaskStatus }): boolean {
    if (!task.deadline) return false;
    if (task.status === TaskStatus.DONE) return false;
    return task.deadline.getTime() < Date.now();
  }

  private formatTask(task: TaskWithRelations) {
    return {
      id: task.id,
      projectId: task.projectId,
      authorId: task.authorId,
      assigneeId: task.assigneeId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      position: task.position,
      startDate: task.startDate,
      deadline: task.deadline,
      isOverdue: this.isTaskOverdue(task),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      author: task.author,
      assignee: task.assignee,
      labels: task.labels.map((tl) => tl.label),
      commentsCount: task._count.comments,
    };
  }

  private async ensureAssigneeIsProjectMember(
    projectId: string,
    assigneeId: string,
  ): Promise<void> {
    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: assigneeId,
        },
      },
    });
    if (!membership) {
      throw new BadRequestException(
        'Исполнителем можно назначить только участника данного проекта.',
      );
    }
  }

  private async validateProjectLabels(
    projectId: string,
    labelIds: string[],
  ): Promise<string[]> {
    const uniqueIds = Array.from(new Set(labelIds));
    if (uniqueIds.length === 0) return [];

    const found = await this.prisma.label.findMany({
      where: {
        projectId,
        id: { in: uniqueIds },
      },
      select: { id: true },
    });

    if (found.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Одна или несколько выбранных меток не принадлежат этому проекту.',
      );
    }
    return uniqueIds;
  }

  async findAllByProject(projectId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
      include: TASK_INCLUDE,
    });

    return tasks.map((t) => this.formatTask(t));
  }

  async findOne(projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        deletedAt: null,
      },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена в этом проекте.');
    }

    return this.formatTask(task);
  }

  async create(
    projectCtx: ProjectRequestContext,
    user: AuthenticatedUser,
    dto: CreateTaskDto,
  ) {
    if (projectCtx.role === ProjectRole.OBSERVER) {
      throw new ForbiddenException('Наблюдатель не может создавать задачи.');
    }

    // П. 5.2 ТЗ: Участник (MEMBER) не может назначать исполнителей
    if (
      projectCtx.role === ProjectRole.MEMBER &&
      dto.assigneeId !== undefined &&
      dto.assigneeId !== null &&
      dto.assigneeId !== ''
    ) {
      throw new ForbiddenException(
        'Только руководитель проекта может назначать исполнителей задач.',
      );
    }

    const assigneeId =
      dto.assigneeId && dto.assigneeId.trim() !== '' ? dto.assigneeId : null;
    if (assigneeId) {
      await this.ensureAssigneeIsProjectMember(projectCtx.id, assigneeId);
    }

    const startDate = this.parseOptionalDate(dto.startDate) ?? null;
    const deadline = this.parseOptionalDate(dto.deadline) ?? null;

    if (startDate && deadline && deadline < startDate) {
      throw new BadRequestException(
        'Дедлайн не может быть раньше даты начала задачи.',
      );
    }

    const labelIds = dto.labelIds
      ? await this.validateProjectLabels(projectCtx.id, dto.labelIds)
      : [];

    const targetStatus = dto.status ?? TaskStatus.NEW;
    const maxPos = await this.prisma.task.aggregate({
      where: {
        projectId: projectCtx.id,
        status: targetStatus,
        deletedAt: null,
      },
      _max: { position: true },
    });

    const created = await this.prisma.task.create({
      data: {
        projectId: projectCtx.id,
        authorId: user.id,
        assigneeId,
        title: dto.title.trim(),
        description: (dto.description ?? '').trim(),
        status: targetStatus,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        position: (maxPos._max.position ?? -1) + 1,
        startDate,
        deadline,
        ...(labelIds.length > 0
          ? {
              labels: {
                create: labelIds.map((labelId) => ({ labelId })),
              },
            }
          : {}),
      },
      include: TASK_INCLUDE,
    });

    return this.formatTask(created);
  }

  async update(
    projectCtx: ProjectRequestContext,
    user: AuthenticatedUser,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    if (projectCtx.role === ProjectRole.OBSERVER) {
      throw new ForbiddenException('Наблюдатель не может редактировать задачи.');
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        projectId: projectCtx.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Задача не найдена в этом проекте.');
    }

    const isLeader = projectCtx.role === ProjectRole.LEADER;
    const isAuthor = existing.authorId === user.id;

    // П. 5.2 ТЗ: Участник может редактировать только задачи, созданные им самим
    if (!isLeader && !isAuthor) {
      throw new ForbiddenException(
        'Участник может редактировать только собственные задачи (созданные им самим).',
      );
    }

    // П. 5.2 ТЗ: Участник не может назначать или менять исполнителя
    if (!isLeader && dto.assigneeId !== undefined) {
      throw new ForbiddenException(
        'Только руководитель проекта может назначать или изменять исполнителя задачи.',
      );
    }

    let normalizedAssigneeId: string | null | undefined = undefined;
    if (dto.assigneeId !== undefined) {
      normalizedAssigneeId =
        dto.assigneeId && dto.assigneeId.trim() !== '' ? dto.assigneeId : null;
      if (normalizedAssigneeId) {
        await this.ensureAssigneeIsProjectMember(
          projectCtx.id,
          normalizedAssigneeId,
        );
      }
    }

    const startDate = this.parseOptionalDate(dto.startDate);
    const deadline = this.parseOptionalDate(dto.deadline);

    const effectiveStart =
      startDate !== undefined ? startDate : existing.startDate;
    const effectiveDeadline =
      deadline !== undefined ? deadline : existing.deadline;

    if (
      effectiveStart &&
      effectiveDeadline &&
      effectiveDeadline < effectiveStart
    ) {
      throw new BadRequestException(
        'Дедлайн не может быть раньше даты начала задачи.',
      );
    }

    const labelIds =
      dto.labelIds !== undefined
        ? await this.validateProjectLabels(projectCtx.id, dto.labelIds)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (labelIds !== undefined) {
        await tx.taskLabel.deleteMany({ where: { taskId } });
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(normalizedAssigneeId !== undefined
            ? { assigneeId: normalizedAssigneeId }
            : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
          ...(startDate !== undefined ? { startDate } : {}),
          ...(deadline !== undefined ? { deadline } : {}),
          ...(labelIds !== undefined && labelIds.length > 0
            ? {
                labels: {
                  create: labelIds.map((labelId) => ({ labelId })),
                },
              }
            : {}),
        },
        include: TASK_INCLUDE,
      });
    });

    return this.formatTask(updated);
  }

  async updateStatus(
    projectCtx: ProjectRequestContext,
    user: AuthenticatedUser,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    if (projectCtx.role === ProjectRole.OBSERVER) {
      throw new ForbiddenException('Наблюдатель не может изменять статус задач.');
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        projectId: projectCtx.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Задача не найдена в этом проекте.');
    }

    const isLeader = projectCtx.role === ProjectRole.LEADER;
    const isAssignee = existing.assigneeId === user.id;
    const isAuthorOfUnassigned =
      existing.authorId === user.id && existing.assigneeId === null;

    // П. 5.1 и 5.2 ТЗ: Руководитель меняет статус любой задачи;
    // Участник меняет статус назначенных ему задач (или созданных им без исполнителя)
    if (!isLeader && !isAssignee && !isAuthorOfUnassigned) {
      throw new ForbiddenException(
        'Вы можете изменять статус только назначенных вам задач.',
      );
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
      include: TASK_INCLUDE,
    });

    return this.formatTask(updated);
  }

  async remove(
    projectCtx: ProjectRequestContext,
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<void> {
    if (projectCtx.role === ProjectRole.OBSERVER) {
      throw new ForbiddenException('Наблюдатель не может удалять задачи.');
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        projectId: projectCtx.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Задача не найдена в этом проекте.');
    }

    const isLeader = projectCtx.role === ProjectRole.LEADER;
    const isAuthor = existing.authorId === user.id;

    // П. 5.2 ТЗ: Участник может удалять только задачи, созданные им самим
    if (!isLeader && !isAuthor) {
      throw new ForbiddenException(
        'Участник может удалять только собственные задачи (созданные им самим).',
      );
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // Метки проекта (Labels)
  // ==========================================

  async listLabels(projectId: string) {
    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async createLabel(projectId: string, dto: CreateLabelDto) {
    const normalizedName = dto.name.trim();
    const existing = await this.prisma.label.findFirst({
      where: {
        projectId,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException('Метка с таким названием уже есть в проекте.');
    }

    return this.prisma.label.create({
      data: {
        projectId,
        name: normalizedName,
        color: dto.color ?? '#475569',
      },
    });
  }

  async removeLabel(projectId: string, labelId: string): Promise<void> {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) {
      throw new NotFoundException('Метка не найдена в этом проекте.');
    }
    await this.prisma.label.delete({ where: { id: labelId } });
  }
}
