import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  slug?: string;
}
