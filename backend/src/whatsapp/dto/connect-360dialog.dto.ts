import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class Connect360dialogDto {
  /** The business's 360dialog channel API key (the D360-API-KEY value). */
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  apiKey!: string;

  /** Optional display number to show in the UI (e.g. +972 50-123-4567). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  displayPhoneNumber?: string;
}
