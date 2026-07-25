import { IsString, MaxLength, MinLength } from 'class-validator';

export class ImportWebsiteFactsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  url!: string;
}
