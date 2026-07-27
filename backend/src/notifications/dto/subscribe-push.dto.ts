import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class SubscribePushDto {
  @IsString()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class UnsubscribePushDto {
  @IsString()
  endpoint!: string;
}
