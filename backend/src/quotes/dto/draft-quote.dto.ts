import { IsString, MaxLength, MinLength } from 'class-validator';

export class DraftQuoteDto {
  /** One line describing what's being quoted, e.g. "בניית אתר תדמית ל-X". */
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  brief!: string;
}
