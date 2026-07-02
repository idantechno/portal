import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  planCode!: string;
}
