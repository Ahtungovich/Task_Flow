import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString({ message: 'Название проекта обязательно.' })
  @MinLength(2, { message: 'Название проекта должно содержать минимум 2 символа.' })
  @MaxLength(150, { message: 'Название проекта не должно превышать 150 символов.' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой.' })
  @MaxLength(2000, { message: 'Описание не должно превышать 2000 символов.' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Укажите корректную дату начала (YYYY-MM-DD).' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Укажите корректную дату завершения (YYYY-MM-DD).' })
  endDate?: string;
}
