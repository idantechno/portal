import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuoteChannelDto, QuoteLineItemDto } from './create-quote.dto';

export class UpdateQuoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsIn(['draft', 'approved'])
  status?: 'draft' | 'approved';

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  intro?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems?: QuoteLineItemDto[];

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
