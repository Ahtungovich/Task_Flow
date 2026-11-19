import { IsIn, IsString, MinLength } from 'class-validator';

export class AddMemberDto {
  @IsString({ message: 'Укажите email или имя пользователя.' })
  @MinLength(3, { message: 'Укажите email или имя пользователя.' })
  identifier: string;

  @IsIn(['MEMBER', 'OBSERVER'], {
    message:
      'Участнику можно назначить только роль MEMBER (Участник) или OBSERVER (Наблюдатель). Руководитель проекта один и не передаётся.',
  })
  role: 'MEMBER' | 'OBSERVER';
}
