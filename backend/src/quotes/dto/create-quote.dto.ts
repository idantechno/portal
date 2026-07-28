import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuoteChannelDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MaxLength(120)
  budget!: string;
}

export class CreateQuoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  journey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteChannelDto)
  channels?: QuoteChannelDto[];

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  budgetSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  total?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string;
}
