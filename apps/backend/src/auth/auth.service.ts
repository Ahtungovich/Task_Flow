import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountType, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const SESSION_COOKIE_NAME = 'taskflow_sid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  toPublicUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      accountType: user.accountType,
      isTeacherVerified: user.isTeacherVerified,
      emailVerified: user.emailVerified,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private hashToken(rawToken: string): string {
    const secret = this.configService.get<string>('SESSION_SECRET', '');
    return createHash('sha256')
      .update(`${rawToken}:${secret}`)
      .digest('hex');
  }

  private getSessionTtlMs(): number {
    const hours = this.configService.get<number>('SESSION_TTL_HOURS', 168);
    return hours * 60 * 60 * 1000;
  }

  setSessionCookie(res: Response, rawToken: string, expiresAt: Date): void {
    const isSecure = this.configService.get<boolean>('COOKIE_SECURE', false);
    res.cookie(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      expires: expiresAt,
      path: '/',
    });
  }

  clearSessionCookie(res: Response): void {
    const isSecure = this.configService.get<boolean>('COOKIE_SECURE', false);
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
    });
  }

  private async createSession(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.getSessionTtlMs());

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ipAddress?.slice(0, 64),
      },
    });

    return { rawToken, expiresAt };
  }

  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: AuthenticatedUser; rawToken: string; expiresAt: Date }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim();
    const normalizedFullName = dto.fullName.trim();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictException(
        'Пользователь с таким адресом электронной почты уже зарегистрирован.',
      );
    }

    const existingUsername = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: 'insensitive',
        },
      },
    });
    if (existingUsername) {
      throw new ConflictException('Это имя пользователя уже занято.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const autoApproveTeachers = this.configService.get<boolean>(
      'AUTO_APPROVE_TEACHERS',
      true,
    );
    const emailVerificationRequired = this.configService.get<boolean>(
      'EMAIL_VERIFICATION_REQUIRED',
      false,
    );

    const accountType: AccountType =
      dto.accountType === 'TEACHER' ? AccountType.TEACHER : AccountType.STUDENT;

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        fullName: normalizedFullName,
        passwordHash,
        accountType,
        isTeacherVerified:
          accountType === AccountType.TEACHER ? autoApproveTeachers : false,
        emailVerified: !emailVerificationRequired,
      },
    });

    const session = await this.createSession(user.id, meta);

    return {
      user: this.toPublicUser(user),
      rawToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: AuthenticatedUser; rawToken: string; expiresAt: Date }> {
    const identifier = dto.login.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль.');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('Ваш аккаунт заблокирован.');
    }

    const session = await this.createSession(user.id, meta);

    return {
      user: this.toPublicUser(user),
      rawToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  async validateSessionToken(rawToken: string): Promise<AuthenticatedUser | null> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return this.toPublicUser(session.user);
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.session.deleteMany({
      where: { tokenHash },
    });
  }
}
