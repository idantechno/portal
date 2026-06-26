import { IsEnum } from 'class-validator';
import { BusinessRole } from '../../common/enums/business-role.enum';

export class UpdateMemberRoleDto {
  @IsEnum(BusinessRole)
  role!: BusinessRole;
}
