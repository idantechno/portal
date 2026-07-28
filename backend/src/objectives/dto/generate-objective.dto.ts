import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateObjectiveDto {
  @IsOptional()
  @IsBoolean()
  skipDrafting?: boolean;
}
