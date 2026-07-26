import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class CreateAppointmentDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  /** Start — ISO datetime; naive strings are read as Israel local time. */
  @IsString()
  start!: string;

  /** End — ISO datetime. Optional; defaults to start + 60 min. */
  @IsOptional()
  @IsString()
  end?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}
