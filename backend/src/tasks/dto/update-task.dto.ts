import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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

  /** How long a dated task takes, in minutes. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number | null;

  /** Opt this task into (or out of) the reminders sweep — the 🔔 toggle. */
  @IsOptional()
  @IsBoolean()
  remindEnabled?: boolean;

  /** Manual override of when the reminder fires (ISO Israel time). */
  @IsOptional()
  @IsISO8601()
  remindAt?: string | null;

  /** Optional customer WhatsApp number, so the reminder also reaches them.
   *  Empty string clears it (stop reminding the customer). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  remindCustomerPhone?: string | null;

  /** Customer's display name, to personalize their reminder. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remindCustomerName?: string | null;
}
