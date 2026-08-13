import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** The owner's notification-channel choices, from the settings screen. */
export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  email!: boolean;

  /** Override target address; empty → the owner's account email. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailTo?: string;

  @IsBoolean()
  whatsapp!: boolean;

  /** Override WhatsApp number; empty → ownerPhone. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappTo?: string;
}
