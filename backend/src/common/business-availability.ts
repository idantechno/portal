/**
 * Per-business booking availability: WHEN the business is open to take
 * appointments. This is the "are we even open?" layer that sits above the
 * conflict check ("is something else booked?"). The schedule brain offers and
 * the agent books only inside these hours; the owner's own manual bookings are
 * never restricted by it (the owner knows what they're doing).
 *
 * All logic here is pure and timezone-aware — no DB, no I/O — so it can be unit
 * tested and reused by the schedule brain and (later) the free-slot finder.
 */
export interface AvailabilityWindow {
  /** Days the window applies to. 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Local open time, 'HH:MM' (24h). */
  start: string;
  /** Local close time, 'HH:MM'. If end <= start the window wraps past midnight. */
  end: string;
}

export interface BusinessAvailability {
  /**
   * When false, no hours restriction — bookings are accepted at any time (the
   * legacy / opt-out behaviour). A business turns this on to declare hours.
   */
  enabled: boolean;
  /** IANA timezone the windows and days-off are expressed in. Default Israel. */
  timezone?: string;
  /**
   * Open windows. A business open 09:00–13:00 and 16:00–19:00 has two windows;
   * a shop open the same hours every weekday has one window spanning all days.
   */
  windows: AvailabilityWindow[];
  /**
   * Minimum breathing room enforced before AND after every appointment, in
   * minutes (default 0). A 15-minute buffer means a 10:00–11:00 booking blocks
   * 09:45–11:15 for anything else.
   */
  bufferMinutes?: number;
  /** Specific closed dates, 'YYYY-MM-DD' in the business timezone (holidays). */
  daysOff?: string[];
}

export type AvailabilityReason = 'day-off' | 'closed-day' | 'outside-hours';

export interface AvailabilityCheck {
  /** True when [start, end) sits fully inside the business's open hours. */
  ok: boolean;
  /** Why it failed (absent when ok). */
  reason?: AvailabilityReason;
  /** That day's open windows as text, e.g. "09:00–17:00" (empty when closed). */
  openHoursText: string;
}

export const DEFAULT_AVAILABILITY_TIMEZONE = 'Asia/Jerusalem';

/** No config = legacy behaviour: open for bookings at any time. */
export const DEFAULT_AVAILABILITY: BusinessAvailability = {
  enabled: false,
  windows: [],
};

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Local weekday (0=Sun), minutes-since-midnight, and 'YYYY-MM-DD' for a Date. */
function localParts(
  date: Date,
  timezone: string,
): { weekday: number; minutes: number; dateStr: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = WEEKDAY_MAP[get('weekday')] ?? 0;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  return { weekday, minutes: hour * 60 + minute, dateStr };
}

/** The open windows that apply on a given weekday. */
export function windowsForWeekday(
  config: BusinessAvailability,
  weekday: number,
): AvailabilityWindow[] {
  return (config.windows ?? []).filter((w) => w.days?.includes(weekday));
}

/** "09:00–13:00, 16:00–19:00" for the given windows (empty string if none). */
export function formatWindows(windows: AvailabilityWindow[]): string {
  return windows
    .filter((w) => parseHHMM(w.start) !== null && parseHHMM(w.end) !== null)
    .map((w) => `${w.start}–${w.end}`)
    .join(', ');
}

/** Buffer to enforce around each appointment, in minutes (>= 0). */
export function availabilityBufferMinutes(
  config: BusinessAvailability | null | undefined,
): number {
  if (!config?.enabled) return 0;
  const b = config.bufferMinutes ?? 0;
  return b > 0 ? b : 0;
}

/**
 * Does [start, end) fall within the business's open hours? Missing config or
 * `enabled: false` fails OPEN (ok: true) — a business that hasn't declared hours
 * is treated as always open, so this never silently blocks bookings.
 */
export function checkAvailability(
  config: BusinessAvailability | null | undefined,
  start: Date,
  end: Date,
): AvailabilityCheck {
  if (!config || !config.enabled) return { ok: true, openHoursText: '' };

  const tz = config.timezone || DEFAULT_AVAILABILITY_TIMEZONE;
  const s = localParts(start, tz);
  const e = localParts(end, tz);

  // A declared holiday closes the whole day.
  if ((config.daysOff ?? []).includes(s.dateStr)) {
    return { ok: false, reason: 'day-off', openHoursText: '' };
  }

  const wins = windowsForWeekday(config, s.weekday);
  if (wins.length === 0) {
    return { ok: false, reason: 'closed-day', openHoursText: '' };
  }

  // Express the end in start-day minutes so an appointment that runs up to (or
  // past) midnight compares correctly against an overnight window.
  const endMinutes = e.dateStr !== s.dateStr ? e.minutes + 24 * 60 : e.minutes;
  const openHoursText = formatWindows(wins);

  for (const w of wins) {
    const open = parseHHMM(w.start);
    const closeRaw = parseHHMM(w.end);
    if (open === null || closeRaw === null || open === closeRaw) continue;
    // Overnight window (e.g. 18:00–02:00) closes on the next calendar day.
    const close = closeRaw > open ? closeRaw : closeRaw + 24 * 60;
    if (s.minutes >= open && endMinutes <= close) {
      return { ok: true, openHoursText };
    }
  }

  return { ok: false, reason: 'outside-hours', openHoursText };
}
