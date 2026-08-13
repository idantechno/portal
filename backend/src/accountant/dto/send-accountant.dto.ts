import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SendAccountantDto {
  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  /** 1-12; omit (with year) to default to the current month. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
