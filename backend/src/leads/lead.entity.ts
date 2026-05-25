import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Lead captured by the agent via the `capture_lead` tool. One row per
 * customer-volunteered contact intent (interested in a product, wants a
 * callback, etc.). Surfaces to the business in the inbox.
 */
@Entity({ name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'customer_contact_id' })
  customerContactId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'text' })
  interest!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
