import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus } from '../common/enums/account-status.enum';
import type { WhatsappAgentConfig } from '../common/whatsapp-agent-schedule';

/**
 * Owner-supplied characterization of the business, captured once in an
 * onboarding questionnaire and injected into every agent's context so all
 * agents speak and act in line with the business. All fields optional.
 */
export interface BusinessOnboarding {
  /** Marks the questionnaire as answered so we stop prompting for it. */
  completed?: boolean;
  /** What the business does / its field (e.g. "מסעדה איטלקית"). */
  industry?: string;
  /** Who the customers are. */
  audience?: string;
  /** Main products / services offered. */
  offerings?: string;
  /** Desired tone of voice toward customers (affects agent outputs). */
  tone?: string;
  /** Selected brand values that represent/distinguish the business. */
  values?: string[];
  /** The feeling/impression the business wants a customer to leave with. */
  feeling?: string;
  /** Business goals for the coming period. */
  goals?: string;
  /** What sets the business apart from competitors. */
  differentiators?: string;
  /** Anything to emphasize or avoid saying. */
  notes?: string;
  /** City — used for the daily weather widget on the home dashboard. */
  city?: string;
}

/** Per-business look & feel applied across the cockpit UI. All optional. */
export interface BusinessBranding {
  /** Main brand color — base for the sidebar/header. Hex `#rrggbb`. */
  primaryColor?: string;
  /** Secondary brand color — links/highlights. Hex `#rrggbb`. */
  secondaryColor?: string;
  /** Accent color — active state, primary buttons. Hex `#rrggbb`. */
  accentColor?: string;
  /** Logo as a data URI (client-resized) or absolute URL. */
  logoUrl?: string;
  /** Short tagline shown under the business name. */
  slogan?: string;
}

/**
 * How the reminders agent times its default reminders for this business. When a
 * reminder has no explicit time, it fires `defaultLeadHours` before the event,
 * but clamped into the [`quietStart`, `quietEnd`] daily window so no reminder
 * lands in the middle of the night. All optional — null falls back to system
 * defaults (12h lead, 08:00–21:00). Times are Israel wall-clock "HH:MM".
 */
export interface BusinessReminderSettings {
  /** Hours before the event the default reminder fires (default 12). */
  defaultLeadHours?: number;
  /** Earliest time of day a reminder may fire, "HH:MM" (default "08:00"). */
  quietStart?: string;
  /** Latest time of day a reminder may fire, "HH:MM" (default "21:00"). */
  quietEnd?: string;
}

@Entity({ name: 'businesses' })
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: AccountStatus.Active })
  status!: AccountStatus;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'uuid', name: 'owner_user_id' })
  ownerUserId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, name: 'public_key' })
  publicKey!: string;

  @Column({ type: 'boolean', name: 'public_key_enabled', default: true })
  publicKeyEnabled!: boolean;

  @Column({ type: 'text', name: 'system_prompt_override', nullable: true })
  systemPromptOverride!: string | null;

  @Column({
    type: 'jsonb',
    name: 'widget_allowed_origins',
    default: () => "'[]'::jsonb",
  })
  widgetAllowedOrigins!: string[];

  @Column({ type: 'jsonb', name: 'branding', nullable: true })
  branding!: BusinessBranding | null;

  @Column({ type: 'jsonb', name: 'onboarding', nullable: true })
  onboarding!: BusinessOnboarding | null;

  /** WhatsApp agent schedule/mode. Null = always on (legacy default). */
  @Column({ type: 'jsonb', name: 'whatsapp_agent', nullable: true })
  whatsappAgent!: WhatsappAgentConfig | null;

  /**
   * Owner's private phone (E.164, e.g. 972501234567) for direct WhatsApp
   * alerts such as "an appointment was booked". Distinct from the business's
   * customer-facing WABA number.
   */
  @Column({ type: 'varchar', length: 32, name: 'owner_phone', nullable: true })
  ownerPhone!: string | null;

  /** Reminders-agent default timing + quiet-hours window. Null = system defaults. */
  @Column({ type: 'jsonb', name: 'reminder_settings', nullable: true })
  reminderSettings!: BusinessReminderSettings | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Soft-delete marker. When set, the tenant is scheduled for deletion: TypeORM
   * automatically excludes the row from every find/findOne (so the business
   * vanishes from all app queries immediately), while a daily job hard-purges
   * it — and all its data — once the 30-day grace window elapses. Restoring
   * before then (repo.restore) simply clears this back to null.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
