import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ContactStatus } from '../../common/enums/contact-status.enum';
import {
  CONTACT_AGENT_DELAY_CHOICES,
  ContactAgentMode,
} from '../../common/enums/contact-agent-mode.enum';

export class UpdateContactDto {
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string | null;

  /** How the agent treats this contact — active | off | delayed. */
  @IsOptional()
  @IsEnum(ContactAgentMode)
  agentMode?: ContactAgentMode;

  /** Wait window (minutes) for delayed mode. Null clears it; any value must be
   *  one of the UI's fixed choices. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @IsIn(CONTACT_AGENT_DELAY_CHOICES)
  agentDelayMinutes?: number | null;
}
