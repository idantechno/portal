import { IsBoolean } from 'class-validator';

export class SetAgentAccessDto {
  @IsBoolean()
  enabled!: boolean;
}
