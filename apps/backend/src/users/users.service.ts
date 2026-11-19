import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.trim();
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          username: {
            equals: normalizedUsername,
            mode: 'insensitive',
          },
        },
      });
      if (conflict) {
        throw new ConflictException('Это имя пользователя уже занято.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.username !== undefined ? { username: dto.username.trim() } : {}),
        ...(dto.avatar !== undefined
          ? { avatar: dto.avatar ? dto.avatar.trim() : null }
          : {}),
      },
    });

    return this.authService.toPublicUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    const isCurrentValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Текущий пароль указан неверно.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Новый пароль должен отличаться от текущего.',
      );
    }

    const newHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }
}
