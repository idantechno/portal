import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8192)
  systemPromptOverride?: string;

  @IsOptional()
  @IsBoolean()
  publicKeyEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  widgetAllowedOrigins?: string[];
}
