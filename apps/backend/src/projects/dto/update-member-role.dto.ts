import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsIn(['MEMBER', 'OBSERVER'], {
    message:
      'Можно установить только роль MEMBER (Участник) или OBSERVER (Наблюдатель). Передача роли руководителя не предусмотрена.',
  })
  role: 'MEMBER' | 'OBSERVER';
}
