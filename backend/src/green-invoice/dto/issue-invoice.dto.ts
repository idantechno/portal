import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class InvoiceLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  /** Unit price in shekels (not agorot). */
  @IsNumber()
  @Min(0)
  price!: number;
}

export class IssueInvoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerName!: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  /** Customer tax id (ע.מ/ח.פ), optional. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerTaxId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items!: InvoiceLineDto[];
}
