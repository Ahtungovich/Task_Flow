import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLabelDto {
  @IsString({ message: 'Название метки обязательно.' })
  @MinLength(1, { message: 'Название метки не может быть пустым.' })
  @MaxLength(40, { message: 'Название метки не должно превышать 40 символов.' })
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'Цвет метки должен быть в HEX-формате, например #2563eb.',
  })
  color?: string;
}
