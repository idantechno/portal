import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  sessionId!: string;
}
