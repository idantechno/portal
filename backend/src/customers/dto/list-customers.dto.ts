import { IsIn, IsOptional } from 'class-validator';

/** How the customers list is ordered. Mirrors the sort control in the UI. */
export type CustomerSort = 'recent' | 'alpha' | 'next_activity';

export class ListCustomersQueryDto {
  @IsOptional()
  @IsIn(['recent', 'alpha', 'next_activity'])
  sort?: CustomerSort;
}
