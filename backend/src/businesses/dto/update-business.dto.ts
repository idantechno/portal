import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BrandingDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  // Data URI of a client-resized logo (kept small) or an absolute URL.
  @IsOptional()
  @IsString()
  @MaxLength(600_000)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  slogan?: string;
}

export class OnboardingDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  offerings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  goals?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  differentiators?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingDto)
  onboarding?: OnboardingDto;
}
