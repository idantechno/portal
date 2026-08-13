import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreateQuoteDto } from './create-quote.dto';

/**
 * Create a quote for a recipient identified by name + phone/email rather than a
 * pre-existing customer. The person is found-or-created (deduped by phone/email)
 * as a `lead`-stage customer, so quoting a bare phone number captures it in the
 * CRM instead of requiring the operator to add a customer first.
 */
export class CreateQuoteForRecipientDto extends CreateQuoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  recipientName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  recipientPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  recipientEmail?: string;
}
