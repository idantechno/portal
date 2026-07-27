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
