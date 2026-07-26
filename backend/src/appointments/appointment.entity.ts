import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';

/**
 * A booked appointment for a business (clinic slot, studio session, meeting).
 * Created by the agent via `schedule_appointment` or manually by the operator.
 * Mirrored into Google Calendar when connected (`calendarEventId`), but the DB
 * row is the source of truth so the queue/waitlist (phase C) works with or
 * without a calendar connection.
 */
@Entity({ name: 'appointments' })
@Index('idx_appointment_business_start', ['businessId', 'startAt'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** The customer this appointment is for (their number/card). */
  @Index()
  @Column({ type: 'uuid', name: 'customer_contact_id', nullable: true })
  customerContactId!: string | null;

  /** The conversation it was booked from, if any. */
  @Column({ type: 'uuid', name: 'conversation_id', nullable: true })
  conversationId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'timestamptz', name: 'start_at' })
  startAt!: Date;

  @Column({ type: 'timestamptz', name: 'end_at' })
  endAt!: Date;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.Scheduled,
  })
  status!: AppointmentStatus;

  /** Snapshot of the customer's name at booking time (contact may lack one). */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_name',
    nullable: true,
  })
  customerName!: string | null;

  /** Customer phone captured at booking, for follow-up. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Google Calendar event id, when a calendar is connected. */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'calendar_event_id',
    nullable: true,
  })
  calendarEventId!: string | null;

  /** Who created it — the agent or a human operator. */
  @Column({ type: 'varchar', length: 16, default: 'agent' })
  source!: 'agent' | 'manual';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
