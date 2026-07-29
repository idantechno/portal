import { parseIsraelDate } from './israel-time';
import type { BusinessReminderSettings } from '../../businesses/business.entity';

/**
 * Computes WHEN a reminder should fire for an event, distinct from when the
 * event itself happens.
 *
 * Two modes:
 * - Explicit offset ("remind me two hours before") — honored literally:
 *   `eventAt - offset`, no quiet-hours clamp. The owner asked for a precise
 *   time; we don't second-guess it.
 * - Default — fires `defaultLeadHours` before the event (12h out of the box),
 *   then clamped into the business's daily [quietStart, quietEnd] window so a
 *   default reminder never lands in the middle of the night. The clamp is
 *   evaluated in Israel wall-clock time.
 *
 * The result is never after the event itself (a very-soon event just reminds at
 * event time / immediately on the next sweep).
 */

export const DEFAULT_LEAD_HOURS = 12;
export const DEFAULT_QUIET_START = '08:00';
export const DEFAULT_QUIET_END = '21:00';

/** Israel wall-clock date ("YYYY-MM-DD") and minutes-past-midnight of an instant. */
function israelDayAndMinutes(at: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  // en-CA with hour12:false can render midnight as "24"; normalize to 0.
  const hour = Number(parts.hour) % 24;
  const minutes = hour * 60 + Number(parts.minute);
  return { date, minutes };
}

/** "HH:MM" → minutes past midnight; falls back to `dflt` on bad input. */
function parseHhMm(value: string | undefined, dflt: number): number {
  if (!value) return dflt;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return dflt;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins < 24 * 60 ? mins : dflt;
}

export function computeRemindAt(
  eventAt: Date,
  settings: BusinessReminderSettings | null | undefined,
  opts?: { explicitOffsetMinutes?: number | null },
): Date {
  const offset = opts?.explicitOffsetMinutes;
  if (offset != null && Number.isFinite(offset)) {
    return new Date(eventAt.getTime() - offset * 60_000);
  }

  const lead = settings?.defaultLeadHours ?? DEFAULT_LEAD_HOURS;
  const candidate = new Date(eventAt.getTime() - lead * 3_600_000);
  const { date, minutes } = israelDayAndMinutes(candidate);
  const startMin = parseHhMm(settings?.quietStart, 8 * 60);
  const endMin = parseHhMm(settings?.quietEnd, 21 * 60);

  let clamped = minutes;
  if (minutes < startMin) clamped = startMin;
  else if (minutes > endMin) clamped = endMin;

  let remindAt = candidate;
  if (clamped !== minutes) {
    const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
    const mm = String(clamped % 60).padStart(2, '0');
    remindAt = parseIsraelDate(`${date}T${hh}:${mm}:00`) ?? candidate;
  }

  // A reminder must never fire after the thing it reminds about.
  return remindAt.getTime() > eventAt.getTime() ? eventAt : remindAt;
}
