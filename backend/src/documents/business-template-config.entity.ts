import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BrandConfig } from './documents.types';

/**
 * Per-business overrides for a global DocumentTemplate. Holds the brand
 * (logo, primary color, font) and per-section boilerplate text overrides
 * (cancellation terms, payment terms, etc.) that get merged with the
 * template at render time.
 */
@Entity({ name: 'business_template_configs' })
@Unique(['businessId', 'templateId'])
export class BusinessTemplateConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  boilerplate!: Record<string, string>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  brand!: BrandConfig;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
