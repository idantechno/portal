import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WaitlistStatus } from '../common/enums/waitlist-status.enum';

/**
 * A customer waiting for an appointment slot to open. Created when the agent
 * offers the waitlist (their preferred time was taken). When an appointment is
 * cancelled, the queue is scanned oldest-first for a waiting entry whose window
 * matches the freed slot, and that person is offered it.
 */
@Entity({ name: 'waitlist_entries' })
@Index('idx_waitlist_business_status', ['businessId', 'status'])
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'customer_contact_id', nullable: true })
  customerContactId!: string | null;

  @Column({ type: 'uuid', name: 'conversation_id', nullable: true })
  conversationId!: string | null;

  /** What they want — the service/appointment description. */
  @Column({ type: 'varchar', length: 255 })
  service!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_name',
    nullable: true,
  })
  customerName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  /**
   * Earliest / latest date-time the customer would accept a slot within, both
   * optional. Null bounds mean "any time" — a freed slot always matches.
   */
  @Column({ type: 'timestamptz', name: 'preferred_from', nullable: true })
  preferredFrom!: Date | null;

  @Column({ type: 'timestamptz', name: 'preferred_to', nullable: true })
  preferredTo!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.Waiting,
  })
  status!: WaitlistStatus;

  /** When a freed slot was offered, and which slot (start ISO) — for follow-up. */
  @Column({ type: 'timestamptz', name: 'offered_at', nullable: true })
  offeredAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'offered_slot_start', nullable: true })
  offeredSlotStart!: Date | null;

  /**
   * When this is a "move earlier" offer (an existing customer invited to bring
   * a later appointment forward into the freed slot), the id of the appointment
   * to move. Null for an ordinary new-booking offer.
   */
  @Column({
    type: 'uuid',
    name: 'move_appointment_id',
    nullable: true,
  })
  moveAppointmentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
