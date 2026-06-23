import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class BrandConfigDto {
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i, {
    message: 'primaryColor must be a 6-char hex like #0e8b3d',
  })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  font?: string;
}

export class UpsertBusinessConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandConfigDto)
  brand?: BrandConfigDto;

  @IsOptional()
  @IsObject()
  boilerplate?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
