import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { WaitlistStatus } from '../../common/enums/waitlist-status.enum';

export class ListWaitlistQueryDto {
  @IsOptional()
  @IsEnum(WaitlistStatus)
  status?: WaitlistStatus;
}

export class CreateWaitlistDto {
  @IsString()
  @MaxLength(255)
  service!: string;

  @IsOptional()
  @IsUUID()
  customerContactId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  /** ISO date-time; naive strings read as Israel local time. */
  @IsOptional()
  @IsString()
  preferredFrom?: string;

  @IsOptional()
  @IsString()
  preferredTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
