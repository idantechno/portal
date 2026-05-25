import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BusinessRole } from '../../common/enums/business-role.enum';

/**
 * Phase 1 invitation: owner sets a temporary password and shares it out of band.
 * Proper email-based invitation tokens land in a later slice.
 */
export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsEnum(BusinessRole)
  role!: BusinessRole;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword!: string;
}
