import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBriefDto {
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  markdown?: string;

  @IsOptional()
  @IsIn(['draft', 'approved'])
  status?: 'draft' | 'approved';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
