export enum AppointmentStatus {
  /** Booked and on the calendar. */
  Scheduled = 'scheduled',
  /** Called off — the slot is free again (drives the waitlist in phase C). */
  Cancelled = 'cancelled',
  /** The appointment took place. */
  Completed = 'completed',
  /** No longer waiting — a held slot the customer never confirmed. */
  NoShow = 'no_show',
}
