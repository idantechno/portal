/**
 * Buckets a reminder's due date the way the owner thinks about their day:
 * overdue / today / soon (next 7 days) / later / no date — computed on the
 * ISRAEL calendar day so "today" matches the owner's day, not UTC.
 */
export type ReminderBucket = 'overdue' | 'today' | 'soon' | 'later' | 'no_date';

const TZ = 'Asia/Jerusalem';

/** YYYY-MM-DD for a date in Israel time (en-CA yields ISO-ordered, comparable). */
function israelDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function bucketFor(
  due: Date | null,
  now: Date = new Date(),
): ReminderBucket {
  if (!due) return 'no_date';
  const today = israelDayKey(now);
  const dueKey = israelDayKey(due);
  if (dueKey < today) return 'overdue';
  if (dueKey === today) return 'today';
  const diffDays = (Date.parse(dueKey) - Date.parse(today)) / 86_400_000;
  return diffDays <= 7 ? 'soon' : 'later';
}
