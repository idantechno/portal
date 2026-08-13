import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { CrmDestinationType } from '../crm-connection.entity';

export class UpsertCrmDto {
  @IsOptional()
  @IsIn(['webhook'])
  type?: CrmDestinationType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  url!: string;

  /** New signing secret; omit to keep the current one, "" to clear it. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  pushLeads?: boolean;

  @IsOptional()
  @IsBoolean()
  pushAppointments?: boolean;
}
