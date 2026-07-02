import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  AutomationActionType,
  AutomationTrigger,
} from '../automation.constants';

class ActionDto {
  @IsIn(AUTOMATION_ACTION_TYPES)
  type!: AutomationActionType;

  @IsObject()
  params!: Record<string, unknown>;
}

class ConditionDto {
  @IsString()
  @MaxLength(64)
  field!: string;

  // `equals` is intentionally untyped (any JSON value).
  equals!: unknown;
}

export class UpsertAutomationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsIn(AUTOMATION_TRIGGERS)
  trigger!: AutomationTrigger;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions!: ActionDto[];
}
