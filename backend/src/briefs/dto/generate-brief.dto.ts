import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateBriefDto {
  /** Website to run the 🟢 extraction against. Omit to skip that layer. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  websiteUrl?: string;

  /** 🔵 only — skips the model call (fast, and free). */
  @IsOptional()
  @IsBoolean()
  skipDrafting?: boolean;
}
