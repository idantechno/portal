import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { TaskKind, TaskPriority } from '../task.entity';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  /** How long a dated task takes, in minutes. Absent → a flat 30-min block. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  /** 'reminder' when the owner adds a standalone reminder in the תזכורות tab;
   *  defaults to 'task' (a to-do). */
  @IsOptional()
  @IsIn(['task', 'reminder'])
  kind?: TaskKind;

  /** Opt this into the reminders sweep (the 🔔 on a task, or always-on for a
   *  standalone reminder). */
  @IsOptional()
  @IsBoolean()
  remindEnabled?: boolean;

  /** When to fire the reminder, ISO. Null/absent → fire at dueAt. */
  @IsOptional()
  @IsISO8601()
  remindAt?: string;

  /** Optional customer WhatsApp number, so the reminder also reaches them. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  remindCustomerPhone?: string;

  /** Customer's display name, to personalize their reminder. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remindCustomerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  relatedType?: string;

  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
