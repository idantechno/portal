import { IsString, MaxLength, MinLength } from 'class-validator';

export class DraftQuoteDto {
  /**
   * What's being quoted. May be a short one-line brief OR a longer pasted block
   * (an old quote, an email, notes) that the drafter restructures into a quote.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(8000)
  brief!: string;
}
