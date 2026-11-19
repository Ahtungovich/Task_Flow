import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator';
import { AuthenticatedUser } from '../types/auth-user.type';

export interface ProjectRequestContext {
  id: string;
  name: string;
  leaderId: string;
  creatorId: string;
  status: string;
  role: ProjectRole;
}

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser; projectContext?: ProjectRequestContext }
    >();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован.');
    }

    const projectId = request.params?.projectId || request.params?.id;
    if (!projectId) {
      return true;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        memberships: {
          where: { userId: user.id },
          take: 1,
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден.');
    }

    const membership = project.memberships[0];
    if (!membership) {
      // Изоляция данных: пользователь вне проекта не получает доступ
      throw new ForbiddenException('У вас нет доступа к этому проекту.');
    }

    const effectiveRole: ProjectRole =
      project.leaderId === user.id ? ProjectRole.LEADER : membership.role;

    request.projectContext = {
      id: project.id,
      name: project.name,
      leaderId: project.leaderId,
      creatorId: project.creatorId,
      status: project.status,
      role: effectiveRole,
    };

    const allowedRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(effectiveRole)) {
        throw new ForbiddenException(
          'Недостаточно прав для выполнения этого действия в проекте.',
        );
      }
    }

    return true;
  }
}
