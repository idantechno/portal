import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendAgentReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}
