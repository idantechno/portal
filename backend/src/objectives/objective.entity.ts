import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A goals-&-objectives doc is a draft until approved (the client signs off,
 *  the operator marks it approved on their behalf). */
export type ObjectiveStatus = 'draft' | 'approved';

/**
 * One "יעדים ומטרות" (goals & objectives) document for a customer — three
 * sections: campaign goals, success metrics, target audience. The agent infers
 * a draft from the customer's prior reports (mainly the approved brief); the
 * operator reviews, sends it to the end-client, and marks it approved once the
 * client signs off. An approved objectives doc is one of the campaign's stage-C
 * prerequisites.
 */
@Entity({ name: 'objectives' })
export class Objective {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId!: string | null;

  /** The brief this was inferred from. Null once that brief is gone. */
  @Index()
  @Column({ type: 'uuid', name: 'brief_id', nullable: true })
  briefId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  markdown!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: ObjectiveStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ type: 'boolean', name: 'edited', default: false })
  edited!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
