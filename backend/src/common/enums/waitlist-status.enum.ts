export enum WaitlistStatus {
  /** In line, waiting for a matching slot to open. */
  Waiting = 'waiting',
  /** A freed slot was offered to them; awaiting their confirmation. */
  Offered = 'offered',
  /** They took an offered slot — an appointment was booked. */
  Booked = 'booked',
  /** Removed from the list (by them, the owner, or after declining). */
  Cancelled = 'cancelled',
}
