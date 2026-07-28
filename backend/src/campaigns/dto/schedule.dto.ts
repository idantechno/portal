import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ScheduleItemDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(64)
  kind!: string;

  @IsString()
  @MaxLength(120)
  channel!: string;

  @IsISO8601()
  at!: string;

  @IsString()
  @MaxLength(120)
  funding!: string;
}

export class BuildScheduleDto {
  @IsIn(['monthly', 'half_year', 'yearly'])
  horizon!: 'monthly' | 'half_year' | 'yearly';
}

export class SaveScheduleDto {
  @IsOptional()
  @IsIn(['monthly', 'half_year', 'yearly'])
  horizon?: 'monthly' | 'half_year' | 'yearly';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  items!: ScheduleItemDto[];
}
