import { TaskStatus } from '@prisma/client';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsIn(
    ['NEW', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'POSTPONED'],
    {
      message: 'Указан недопустимый статус задачи.',
    },
  )
  status: TaskStatus;

  @IsOptional()
  @IsInt({ message: 'Позиция карточки должна быть целым числом.' })
  @Min(0)
  position?: number;
}
