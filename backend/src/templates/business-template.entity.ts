import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Per-business grant of a catalog template. Absence of a row means "follow the
 * catalog default" (base templates on, special ones off); an explicit row is a
 * manual override BOTH ways (grant a special one, or revoke a base one).
 * Mirrors {@link BusinessAgent}.
 */
@Entity({ name: 'business_templates' })
@Index('uq_business_template', ['businessId', 'templateName'], { unique: true })
export class BusinessTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 64, name: 'template_name' })
  templateName!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'uuid', name: 'granted_by_user_id', nullable: true })
  grantedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
