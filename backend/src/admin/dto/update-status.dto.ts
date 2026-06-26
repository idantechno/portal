import { IsEnum } from 'class-validator';
import { AccountStatus } from '../../common/enums/account-status.enum';

export class UpdateStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;
}
