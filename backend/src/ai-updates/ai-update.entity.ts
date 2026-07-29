import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Who a digest is for:
 * - 'business'  — the daily AI-news digest shown to every tenant.
 * - 'internal'  — the weekly Anthropic/Claude digest for the operator only.
 */
export type AiUpdateScope = 'business' | 'internal';

/** One highlighted item inside a digest. */
export interface AiUpdateItem {
  headline: string;
  detail: string;
}

/** A cited source the digest was based on. */
export interface AiUpdateSource {
  title: string;
  url: string;
}

/**
 * A single globally-generated AI-updates digest. Content is NOT per-tenant: one
 * row per generation, distinguished only by `scope`. Business digests are shown
 * to all tenants that have the ai-updates agent; internal digests are operator
 * (platform-admin) only.
 */
@Entity({ name: 'ai_updates' })
export class AiUpdate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 16, name: 'scope' })
  scope!: AiUpdateScope;

  @Column({ type: 'varchar', length: 255, name: 'title' })
  title!: string;

  /** Short markdown lede for the digest. */
  @Column({ type: 'text', name: 'summary' })
  summary!: string;

  @Column({ type: 'jsonb', name: 'items', default: () => "'[]'::jsonb" })
  items!: AiUpdateItem[];

  @Column({ type: 'jsonb', name: 'sources', default: () => "'[]'::jsonb" })
  sources!: AiUpdateSource[];

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
