import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { TaskPriority, TaskStatus } from '../task.entity';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(['open', 'in_progress', 'done'])
  status?: TaskStatus;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601()
  dueAt?: string | null;

  /** Opt this task into (or out of) the reminders sweep — the 🔔 toggle. */
  @IsOptional()
  @IsBoolean()
  remindEnabled?: boolean;

  /** Manual override of when the reminder fires (ISO Israel time). */
  @IsOptional()
  @IsISO8601()
  remindAt?: string | null;
}
