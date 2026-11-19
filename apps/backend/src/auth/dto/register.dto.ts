import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты.' })
  @MaxLength(255)
  email: string;

  @IsString({ message: 'Имя пользователя обязательно.' })
  @MinLength(3, { message: 'Имя пользователя должно содержать минимум 3 символа.' })
  @MaxLength(32, { message: 'Имя пользователя не должно превышать 32 символа.' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчёркивания.',
  })
  username: string;

  @IsString({ message: 'ФИО обязательно для заполнения.' })
  @MinLength(2, { message: 'Укажите имя и фамилию (минимум 2 символа).' })
  @MaxLength(120, { message: 'ФИО не должно превышать 120 символов.' })
  fullName: string;

  @IsString({ message: 'Пароль обязателен.' })
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов.' })
  @MaxLength(128, { message: 'Пароль не должен превышать 128 символов.' })
  password: string;

  @IsIn(['STUDENT', 'TEACHER'], {
    message: 'Тип аккаунта должен быть STUDENT или TEACHER.',
  })
  accountType: 'STUDENT' | 'TEACHER';
}
