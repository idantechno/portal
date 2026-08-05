import { IsIn, IsOptional } from 'class-validator';
import { ContactStatus } from '../../common/enums/contact-status.enum';

/** How the customers list is ordered. Mirrors the sort control in the UI. */
export type CustomerSort = 'recent' | 'alpha' | 'next_activity';

export class ListCustomersQueryDto {
  @IsOptional()
  @IsIn(['recent', 'alpha', 'next_activity'])
  sort?: CustomerSort;

  /**
   * Optional lifecycle filter for the emerging unified screen. Omitted →
   * returns every row (unchanged behavior for today's לקוחות list).
   */
  @IsOptional()
  @IsIn([ContactStatus.Lead, ContactStatus.Customer])
  stage?: ContactStatus;
}
