import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload returned by FB.login on the frontend after a successful Embedded
 * Signup. Meta hands us a one-time `code` to exchange for an access token,
 * plus the WABA + phone number IDs the user selected/created.
 */
export class EmbeddedSignupExchangeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(2048)
  code!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  wabaId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  phoneNumberId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  metaBusinessId?: string;
}
