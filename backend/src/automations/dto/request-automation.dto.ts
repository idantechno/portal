import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * A business owner's free-text REQUEST for a new automation. Owners cannot
 * author rules themselves (only platform staff can) — this captures what they
 * want in plain Hebrew and routes it to the operator as a support request.
 */
export class RequestAutomationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  /** Optional: when should it happen (free text, not the strict catalog). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  trigger?: string;

  /** Optional: who/what it concerns (a phone number, a customer, a document…). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;
}
