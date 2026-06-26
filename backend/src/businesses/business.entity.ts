import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus } from '../common/enums/account-status.enum';

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
