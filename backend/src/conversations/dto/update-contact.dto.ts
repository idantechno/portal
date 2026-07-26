import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContactStatus } from '../../common/enums/contact-status.enum';

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
}
