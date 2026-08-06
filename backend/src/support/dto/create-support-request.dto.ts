import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * A business member's free-text request for HELP / support from the operator.
 * Files into the same cross-tenant support inbox the operator watches — the
 * subject marks it as a support enquiry (distinct from automation requests and
 * agent escalations, which use their own subjects).
 */
export class CreateSupportRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  /** Optional short headline the owner can give the request. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}
