/**
 * BullMQ queue that periodically reconciles our appointments against the
 * owner's Google Calendar — catching deletes/moves made INSIDE Google that the
 * one-way write path never hears about.
 */
export const CALENDAR_RECONCILE_QUEUE = 'calendar-reconcile';
