import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  relatedType?: string;

  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
