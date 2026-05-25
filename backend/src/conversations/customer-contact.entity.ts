import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../common/enums/channel.enum';

/**
 * A unique end-user per (business, channel, external_id) — e.g. one WhatsApp
 * phone number, one Instagram IGSID, one web widget session.
 */
@Entity({ name: 'customer_contacts' })
@Index('uq_contact_external', ['businessId', 'channel', 'externalId'], {
  unique: true,
})
export class CustomerContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'enum', enum: Channel })
  channel!: Channel;

  /** Channel-native ID: phone number (whatsapp), IGSID (instagram), session token (web). */
  @Column({ type: 'varchar', length: 255, name: 'external_id' })
  externalId!: string;

  @Column({ type: 'varchar', length: 255, name: 'display_name', nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
