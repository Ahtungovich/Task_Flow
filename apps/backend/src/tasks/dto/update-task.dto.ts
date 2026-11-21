import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString({ message: 'Название задачи должно быть строкой.' })
  @MinLength(2, { message: 'Название задачи должно содержать минимум 2 символа.' })
  @MaxLength(200, { message: 'Название задачи не должно превышать 200 символов.' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой.' })
  @MaxLength(5000, { message: 'Описание не должно превышать 5000 символов.' })
  description?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsUUID('4', { message: 'Некорректный идентификатор исполнителя.' })
  assigneeId?: string | null;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    message: 'Приоритет должен быть LOW, MEDIUM, HIGH или CRITICAL.',
  })
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(
    ['NEW', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'POSTPONED'],
    {
      message: 'Указан недопустимый статус задачи.',
    },
  )
  status?: TaskStatus;

  @IsOptional()
  @IsInt({ message: 'Позиция должна быть целым числом.' })
  @Min(0)
  position?: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString({}, { message: 'Укажите корректную дату начала.' })
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString({}, { message: 'Укажите корректный дедлайн.' })
  deadline?: string | null;

  @IsOptional()
  @IsArray({ message: 'Метки должны передаваться массивом.' })
  @IsUUID('4', { each: true, message: 'Некорректный идентификатор метки.' })
  labelIds?: string[];
}
