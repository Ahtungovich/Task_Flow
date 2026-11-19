import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'ФИО должно быть строкой.' })
  @MinLength(2, { message: 'ФИО должно содержать минимум 2 символа.' })
  @MaxLength(120, { message: 'ФИО не должно превышать 120 символов.' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'Имя пользователя должно быть строкой.' })
  @MinLength(3, { message: 'Имя пользователя должно содержать минимум 3 символа.' })
  @MaxLength(32, { message: 'Имя пользователя не должно превышать 32 символа.' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчёркивания.',
  })
  username?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null && value !== '')
  @IsUrl(
    { require_protocol: true },
    { message: 'Ссылка на аватар должна начинаться с http:// или https://.' },
  )
  @MaxLength(500)
  avatar?: string | null;
}
