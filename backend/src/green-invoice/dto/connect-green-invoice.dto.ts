import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { GreenInvoiceEnv } from '../green-invoice-connection.entity';

export class ConnectGreenInvoiceDto {
  /** Green Invoice API key "id". */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiKeyId!: string;

  /** Green Invoice API key "secret". */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiSecret!: string;

  @IsOptional()
  @IsIn(['sandbox', 'production'])
  environment?: GreenInvoiceEnv;
}
