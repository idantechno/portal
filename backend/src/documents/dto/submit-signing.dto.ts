import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitSigningDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  signerFullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  signerId?: string;

  /**
   * The recipient's signature as a data URL (data:image/png;base64,...) or
   * inline SVG. The frontend captures it via react-signature-canvas.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(2_000_000)
  signatureSvg!: string;
}
