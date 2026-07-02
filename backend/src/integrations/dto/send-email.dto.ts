import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;
}
