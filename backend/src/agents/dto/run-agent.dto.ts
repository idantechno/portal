import { IsString, MaxLength, MinLength } from 'class-validator';

export class RunAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  instruction!: string;
}
