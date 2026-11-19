import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService, SESSION_COOKIE_NAME } from '../../auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_VERIFIED_TEACHER_KEY } from '../decorators/require-verified-teacher.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const rawToken = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (!rawToken) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException('Требуется авторизация.');
    }

    const user = await this.authService.validateSessionToken(rawToken);
    if (!user) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException('Сессия недействительна или истекла.');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('Ваш аккаунт заблокирован.');
    }

    request.user = user;

    const requireVerifiedTeacher = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_VERIFIED_TEACHER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireVerifiedTeacher) {
      if (user.accountType !== 'TEACHER' || !user.isTeacherVerified) {
        throw new ForbiddenException(
          'Действие доступно только подтверждённым преподавателям.',
        );
      }
    }

    return true;
  }
}
