import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'Укажите email или имя пользователя.' })
  @MinLength(3, { message: 'Укажите email или имя пользователя.' })
  @MaxLength(255)
  login: string;

  @IsString({ message: 'Пароль обязателен.' })
  @MinLength(1, { message: 'Введите пароль.' })
  @MaxLength(128)
  password: string;
}
