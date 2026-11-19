import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Укажите текущий пароль.' })
  @MinLength(1, { message: 'Укажите текущий пароль.' })
  @MaxLength(128)
  currentPassword: string;

  @IsString({ message: 'Новый пароль обязателен.' })
  @MinLength(8, { message: 'Новый пароль должен содержать минимум 8 символов.' })
  @MaxLength(128, { message: 'Новый пароль не должен превышать 128 символов.' })
  newPassword: string;
}
