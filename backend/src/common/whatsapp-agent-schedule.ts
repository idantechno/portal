/**
 * Per-business control over WHEN the WhatsApp agent answers automatically.
 *
 * This governs the WhatsApp channel only. The website widget always uses the
 * agent (see ConversationsService.shouldAgentReply) — a business owner is not
 * expected to man the web chat by hand.
 *
 * Model:
 *  - `always`    — agent answers 24/7 (the default / legacy behaviour).
 *  - `off`       — agent never answers; every WhatsApp thread is manual.
 *  - `scheduled` — agent answers only inside the configured weekly windows;
 *                  outside them the owner handles the chat by hand.
 *
 * A per-conversation takeover (status `human`) always wins over the schedule —
 * the schedule only decides what happens to threads the agent is driving.
 */
export interface WhatsappAgentWindow {
  /** Days the window applies to. 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Local start time, 'HH:mm' (24h). */
  start: string;
  /** Local end time, 'HH:mm'. If end <= start the window wraps past midnight. */
  end: string;
}

export interface WhatsappAgentConfig {
  mode: 'always' | 'off' | 'scheduled';
  /** IANA timezone the windows are expressed in. Defaults to Asia/Jerusalem. */
  timezone?: string;
  /** Active windows, used only when mode === 'scheduled'. */
  windows?: WhatsappAgentWindow[];
  /**
   * If a manually-handled (human) thread goes silent for this many hours, it
   * returns to the agent automatically so an after-hours follow-up gets a
   * reply. 0 / undefined disables it.
   */
  autoReturnHours?: number;
}

export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

/** No config = legacy behaviour: the agent is always on. */
export const DEFAULT_WHATSAPP_AGENT: WhatsappAgentConfig = { mode: 'always' };

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Weekday (0=Sun) and minutes-since-midnight for `now` in the given timezone. */
function localWeekdayMinutes(
  now: Date,
  timezone: string,
): { weekday: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[get('weekday')] ?? 0;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return { weekday, minutes: hour * 60 + minute };
}

/**
 * Is the WhatsApp agent allowed to answer right now, per the business config?
 * Unknown / missing config, or mode `always`, returns true (fail open — never
 * silently swallow a customer while a business hasn't opted into scheduling).
 */
export function whatsappAgentActiveNow(
  config: WhatsappAgentConfig | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!config || config.mode === 'always') return true;
  if (config.mode === 'off') return false;

  const tz = config.timezone || DEFAULT_TIMEZONE;
  const { weekday, minutes } = localWeekdayMinutes(now, tz);

  for (const window of config.windows ?? []) {
    if (!window.days?.includes(weekday)) continue;
    const start = parseHHMM(window.start);
    const end = parseHHMM(window.end);
    if (start === null || end === null || start === end) continue;
    if (start < end) {
      // Same-day window, e.g. 09:00–17:00.
      if (minutes >= start && minutes < end) return true;
    } else {
      // Overnight window, e.g. 18:00–09:00 — active late tonight OR early today.
      if (minutes >= start || minutes < end) return true;
    }
  }
  return false;
}
