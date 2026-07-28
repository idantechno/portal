import { IsBoolean, IsOptional } from 'class-validator';

export class GeneratePlanDto {
  /** Skip the model call — produces an empty ⟨לא ידוע⟩ shell (fast, and free). */
  @IsOptional()
  @IsBoolean()
  skipDrafting?: boolean;
}
