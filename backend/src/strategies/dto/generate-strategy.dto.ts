import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateStrategyDto {
  /** Skip the model call — produces an empty ⟨לא ידוע⟩ shell (fast, and free). */
  @IsOptional()
  @IsBoolean()
  skipDrafting?: boolean;
}
