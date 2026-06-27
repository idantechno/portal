import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Admin onboarding payload: provisions a client business + its owner account +
 * agent grants in one action. This is how the operator creates client accounts
 * (there is no public signup).
 */
export class CreateClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  businessName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;

  /** Agent keys to grant the new business (validated against the catalog). */
  @IsArray()
  @IsString({ each: true })
  agentKeys!: string[];
}
