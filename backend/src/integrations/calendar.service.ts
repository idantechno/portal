import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

const CAL_API = 'https://www.googleapis.com/calendar/v3';
const CAL_BASE = `${CAL_API}/calendars/primary/events`;
// Cap fan-out so a big calendar list can't explode into dozens of API calls.
const MAX_CALENDARS = 12;

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime or date (all-day)
  end: string | null;
  allDay: boolean;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface GoogleCalendarListEntry {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
}

/**
 * Reads and writes the business's primary Google Calendar via the connected
 * OAuth tokens. Pure `fetch`; refreshes the access token once on a 401 (same
 * pattern as GmailService).
 */
@Injectable()
export class CalendarService {
  private readonly log = new Logger(CalendarService.name);

  constructor(private readonly integrations: IntegrationsService) {}

  isConnected(businessId: string): Promise<boolean> {
    return this.integrations.isConnected(businessId, 'calendar');
  }

  /** Runs a Google Calendar request, refreshing the token once on a 401. */
  private async call(
    businessId: string,
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    let token = await this.integrations.accessTokenFor(businessId, 'calendar');
    const send = (t: string) =>
      fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
      });
    let res = await send(token);
    if (res.status === 401) {
      token = await this.integrations.refreshAccessTokenFor(
        businessId,
        'calendar',
      );
      res = await send(token);
    }
    return res;
  }

  async listEvents(
    businessId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<CalendarEvent[]> {
    // Read the primary calendar plus any calendar the account has chosen to
    // show (e.g. a personal calendar shared into this account) so shared
    // events surface too — not just the account's own primary.
    const calendarIds = await this.visibleCalendarIds(businessId);
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const all: CalendarEvent[] = [];
    for (const calId of calendarIds) {
      const url = `${CAL_API}/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`;
      const res = await this.call(businessId, url);
      if (!res.ok) {
        // One inaccessible/removed calendar must not fail the whole list.
        this.log.warn(`[calendar] list failed for ${calId}: ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { items?: GoogleEvent[] };
      for (const e of json.items ?? []) {
        all.push({
          id: e.id,
          title: e.summary ?? '(ללא כותרת)',
          start: e.start?.dateTime ?? e.start?.date ?? '',
          end: e.end?.dateTime ?? e.end?.date ?? null,
          allDay: !e.start?.dateTime,
        });
      }
    }

    all.sort((a, b) => a.start.localeCompare(b.start));
    return all.slice(0, 250);
  }

  /**
   * Calendar ids to read events from: the primary plus every calendar the user
   * has selected (visible) in their Google Calendar — which includes calendars
   * shared into this account. Falls back to just `primary` if the list can't be
   * fetched, so behaviour degrades gracefully to the old single-calendar read.
   */
  private async visibleCalendarIds(businessId: string): Promise<string[]> {
    const res = await this.call(businessId, `${CAL_API}/users/me/calendarList`);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.warn(
        `[calendar] calendarList failed: ${res.status} ${detail.slice(0, 200)}`,
      );
      return ['primary'];
    }
    const json = (await res.json()) as { items?: GoogleCalendarListEntry[] };
    // The primary calendar appears here with its own id (the account email), so
    // we use that — NOT the `primary` alias — to avoid reading it twice.
    const ids = (json.items ?? [])
      .filter((c) => c.primary || c.selected === true)
      .map((c) => c.id)
      .filter(Boolean);
    return ids.length ? ids.slice(0, MAX_CALENDARS) : ['primary'];
  }

  /**
   * The timed event happening RIGHT NOW on the business's calendar, if any —
   * used for the agent's "busy" awareness. All-day events are ignored (they
   * don't mean the owner is unreachable this minute). Returns null when nothing
   * is ongoing or the calendar isn't connected.
   */
  async currentEvent(businessId: string): Promise<CalendarEvent | null> {
    if (!(await this.isConnected(businessId))) return null;
    const now = Date.now();
    // Look back far enough to catch a long session already in progress.
    const from = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    const to = new Date(now + 60 * 60 * 1000).toISOString();
    let events: CalendarEvent[];
    try {
      events = await this.listEvents(businessId, from, to);
    } catch (err) {
      this.log.warn(
        `[calendar] currentEvent failed: ${(err as Error).message}`,
      );
      return null;
    }
    return (
      events.find((e) => {
        if (e.allDay || !e.start) return false;
        const start = new Date(e.start).getTime();
        const end = e.end ? new Date(e.end).getTime() : start + 60 * 60 * 1000;
        return start <= now && now < end;
      }) ?? null
    );
  }

  async createEvent(
    businessId: string,
    input: { title: string; start: string; end?: string },
  ): Promise<CalendarEvent> {
    const startDate = new Date(input.start);
    const endDate = input.end
      ? new Date(input.end)
      : new Date(startDate.getTime() + 60 * 60 * 1000);
    const res = await this.call(businessId, CAL_BASE, {
      method: 'POST',
      body: JSON.stringify({
        summary: input.title,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.error(
        `[calendar] create failed ${res.status}: ${detail.slice(0, 200)}`,
      );
      throw new BadRequestException(`CALENDAR_CREATE_FAILED_${res.status}`);
    }
    const e = (await res.json()) as GoogleEvent;
    return {
      id: e.id,
      title: e.summary ?? input.title,
      start: e.start?.dateTime ?? input.start,
      end: e.end?.dateTime ?? null,
      allDay: false,
    };
  }
}
