import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatar: true,
  accountType: true,
} as const;

@Injectable()
export class ProjectsService {
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

  async create(creatorId: string, dto: CreateProjectDto) {
    const startDate = this.parseOptionalDate(dto.startDate) ?? null;
    const endDate = this.parseOptionalDate(dto.endDate) ?? null;

    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(
        'Дата завершения проекта не может быть раньше даты начала.',
      );
    }

    // Атомарно создаём проект и назначаем создателя единственным руководителем (LEADER)
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name.trim(),
          description: (dto.description ?? '').trim(),
          creatorId,
          leaderId: creatorId,
          startDate,
          endDate,
          status: ProjectStatus.ACTIVE,
        },
      });

      await tx.projectMembership.create({
        data: {
          projectId: project.id,
          userId: creatorId,
          role: ProjectRole.LEADER,
        },
      });

      return tx.project.findUniqueOrThrow({
        where: { id: project.id },
        include: {
          leader: { select: USER_PUBLIC_SELECT },
          _count: {
            select: {
              memberships: true,
              tasks: { where: { deletedAt: null } },
            },
          },
        },
      });
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.projectMembership.findMany({
      where: { userId },
      orderBy: { project: { updatedAt: 'desc' } },
      include: {
        project: {
          include: {
            leader: { select: USER_PUBLIC_SELECT },
            _count: {
              select: {
                memberships: true,
                tasks: { where: { deletedAt: null } },
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.project,
      myRole: m.project.leaderId === userId ? ProjectRole.LEADER : m.role,
    }));
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: { select: USER_PUBLIC_SELECT },
        leader: { select: USER_PUBLIC_SELECT },
        memberships: {
          orderBy: { joinedAt: 'asc' },
          include: {
            user: { select: USER_PUBLIC_SELECT },
          },
        },
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден.');
    }

    const myMembership = project.memberships.find((m) => m.userId === userId);
    if (!myMembership) {
      throw new ForbiddenException('У вас нет доступа к этому проекту.');
    }

    const myRole: ProjectRole =
      project.leaderId === userId ? ProjectRole.LEADER : myMembership.role;

    return {
      ...project,
      myRole,
    };
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!existing) {
      throw new NotFoundException('Проект не найден.');
    }

    const startDate = this.parseOptionalDate(dto.startDate);
    const endDate = this.parseOptionalDate(dto.endDate);

    const effectiveStart =
      startDate !== undefined ? startDate : existing.startDate;
    const effectiveEnd = endDate !== undefined ? endDate : existing.endDate;

    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new BadRequestException(
        'Дата завершения проекта не может быть раньше даты начала.',
      );
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        leader: { select: USER_PUBLIC_SELECT },
      },
    });
  }

  async remove(projectId: string) {
    await this.prisma.project.delete({
      where: { id: projectId },
    });
  }

  async listMembers(projectId: string) {
    return this.prisma.projectMembership.findMany({
      where: { projectId },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: { select: USER_PUBLIC_SELECT },
      },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден.');
    }

    const identifier = dto.identifier.trim();
    const targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!targetUser) {
      throw new NotFoundException(
        'Пользователь с указанным email или логином не найден в системе.',
      );
    }

    if (targetUser.isBlocked) {
      throw new BadRequestException('Нельзя добавить заблокированного пользователя.');
    }

    if (targetUser.accountType === 'ADMIN') {
      throw new BadRequestException(
        'Системный администратор не участвует в пользовательских проектах.',
      );
    }

    if (targetUser.id === project.leaderId) {
      throw new ConflictException(
        'Этот пользователь уже является руководителем проекта.',
      );
    }

    const existingMembership = await this.prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException(
        'Этот пользователь уже состоит в данном проекте.',
      );
    }

    return this.prisma.projectMembership.create({
      data: {
        projectId,
        userId: targetUser.id,
        role: dto.role === 'OBSERVER' ? ProjectRole.OBSERVER : ProjectRole.MEMBER,
      },
      include: {
        user: { select: USER_PUBLIC_SELECT },
      },
    });
  }

  async updateMemberRole(
    projectId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден.');
    }

    if (targetUserId === project.leaderId) {
      throw new ForbiddenException(
        'Нельзя изменить роль руководителя проекта.',
      );
    }

    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Участник не найден в этом проекте.');
    }

    return this.prisma.projectMembership.update({
      where: { id: membership.id },
      data: {
        role: dto.role === 'OBSERVER' ? ProjectRole.OBSERVER : ProjectRole.MEMBER,
      },
      include: {
        user: { select: USER_PUBLIC_SELECT },
      },
    });
  }

  async removeMember(projectId: string, targetUserId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден.');
    }

    if (targetUserId === project.leaderId) {
      throw new ForbiddenException(
        'Нельзя удалить руководителя из собственного проекта.',
      );
    }

    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Участник не найден в этом проекте.');
    }

    await this.prisma.projectMembership.delete({
      where: { id: membership.id },
    });
  }
}
