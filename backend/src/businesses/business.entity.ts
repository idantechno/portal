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
import type { BusinessAvailability } from '../common/business-availability';

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
  /**
   * Full brand palette (up to 5) ordered by preference — index 0 is the most
   * preferred. The top three feed `primaryColor`/`secondaryColor`/`accentColor`
   * (kept in sync so every existing consumer keeps working); extra colours are
   * available for richer document designs. Hex `#rrggbb` each.
   */
  palette?: string[];
  /** Main brand color — base for the sidebar/header (= palette[0]). Hex `#rrggbb`. */
  primaryColor?: string;
  /** Secondary brand color — links/highlights (= palette[1]). Hex `#rrggbb`. */
  secondaryColor?: string;
  /** Accent color — active state, primary buttons (= palette[2]). Hex `#rrggbb`. */
  accentColor?: string;
  /** Logo as a data URI (client-resized) or absolute URL. */
  logoUrl?: string;
  /**
   * The logo's OWN background colour (auto-detected on upload; hex). Documents
   * seat the logo on an element of this colour so it reads as transparent on
   * its native background — white for the common light/transparent logo.
   */
  logoBgColor?: string;
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

/**
 * Which channels the owner wants their OWN notifications delivered over. The
 * in-app bell is always on; these are the extra reach-out channels, each
 * independently toggleable (multi-select). Null = system defaults: email on to
 * the owner's account address, WhatsApp on to `ownerPhone`. Push is deliberately
 * NOT stored here — it's a property of the device (does it hold a push
 * subscription), toggled per-device from the settings screen.
 */
export interface BusinessNotificationPreferences {
  /** Also deliver by email. Default true. */
  email?: boolean;
  /** Address to email; null/empty → the owner's account email. */
  emailTo?: string | null;
  /** Also deliver the owner's own reminders/alerts over WhatsApp. Default true. */
  whatsapp?: boolean;
  /** WhatsApp number to reach the owner; null/empty → `ownerPhone`. */
  whatsappTo?: string | null;
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

  /**
   * The business's accountant — the ONLY recipient the "send documents to the
   * accountant" action delivers to. Locked here so the owner (or the agent) can
   * trigger a send but never redirect financial documents to another address.
   */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'accountant_email',
    nullable: true,
  })
  accountantEmail!: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'accountant_phone',
    nullable: true,
  })
  accountantPhone!: string | null;

  /** Reminders-agent default timing + quiet-hours window. Null = system defaults. */
  @Column({ type: 'jsonb', name: 'reminder_settings', nullable: true })
  reminderSettings!: BusinessReminderSettings | null;

  /** Which channels the owner receives their own notifications on. Null = defaults. */
  @Column({
    type: 'jsonb',
    name: 'notification_preferences',
    nullable: true,
  })
  notificationPreferences!: BusinessNotificationPreferences | null;

  /**
   * Booking availability — open hours, inter-appointment buffer, and holidays.
   * Null (or `enabled: false`) = always open for bookings (legacy). The schedule
   * brain offers/books only within it; the owner's manual bookings ignore it.
   */
  @Column({ type: 'jsonb', name: 'availability', nullable: true })
  availability!: BusinessAvailability | null;

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
