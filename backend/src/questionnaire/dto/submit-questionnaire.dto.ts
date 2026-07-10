import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** One rendered answer line for the human-readable summary (email + leads UI). */
export interface AnswerItem {
  label: string;
  value: string;
}

/** A group of answers, mirroring one wizard step. */
export interface AnswerSection {
  title: string;
  items: AnswerItem[];
}

export type BusinessType = 'service' | 'product' | 'both';
export type Audience = 'b2b' | 'b2c' | 'both';
export type PreferredChannel = 'phone' | 'whatsapp' | 'email';

/**
 * Public marketing questionnaire submission. The frontend owns the question
 * schema and sends back both the branching selectors it needs (businessType,
 * audience) and a self-describing `sections` array so the backend can render a
 * readable summary without duplicating the schema.
 *
 * `sections` is validated only as an array — its nested contents are stored
 * as-is in the lead's `answers` jsonb (the global whitelisting ValidationPipe
 * does not strip inside a non-`@ValidateNested` array).
 */
export class SubmitQuestionnaireDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  businessName!: string;

  @IsIn(['service', 'product', 'both'])
  businessType!: BusinessType;

  @IsIn(['b2b', 'b2c', 'both'])
  audience!: Audience;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  contactName!: string;

  // At least one of phone/email is required — enforced in the service.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsIn(['phone', 'whatsapp', 'email'])
  preferredChannel?: PreferredChannel;

  @IsArray()
  sections!: AnswerSection[];

  // Honeypot: a hidden field real users never see. Bots that autofill every
  // input trip it, and we reject. Must be absent or empty.
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'spam detected' })
  hp?: string;
}
