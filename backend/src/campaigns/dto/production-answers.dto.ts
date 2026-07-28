import { IsOptional, IsString, MaxLength } from 'class-validator';

/** The owner's answers to the 3 creative questions (stage B gate). */
export class ProductionAnswersDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  style?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  firstScene?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  clientPresence?: string;
}
