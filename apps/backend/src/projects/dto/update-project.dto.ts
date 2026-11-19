import { ProjectStatus } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString({ message: 'Название проекта должно быть строкой.' })
  @MinLength(2, { message: 'Название проекта должно содержать минимум 2 символа.' })
  @MaxLength(150, { message: 'Название проекта не должно превышать 150 символов.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой.' })
  @MaxLength(2000, { message: 'Описание не должно превышать 2000 символов.' })
  description?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString({}, { message: 'Укажите корректную дату начала.' })
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsDateString({}, { message: 'Укажите корректную дату завершения.' })
  endDate?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'], {
    message: 'Статус проекта должен быть ACTIVE или ARCHIVED.',
  })
  status?: ProjectStatus;
}
