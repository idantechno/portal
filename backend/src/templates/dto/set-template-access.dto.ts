import { IsBoolean } from 'class-validator';

export class SetTemplateAccessDto {
  @IsBoolean()
  enabled!: boolean;
}
