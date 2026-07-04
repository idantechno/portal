import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

const CAL_BASE =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

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
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    const res = await this.call(businessId, `${CAL_BASE}?${params.toString()}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.error(
        `[calendar] list failed ${res.status}: ${detail.slice(0, 200)}`,
      );
      throw new BadRequestException(`CALENDAR_LIST_FAILED_${res.status}`);
    }
    const json = (await res.json()) as { items?: GoogleEvent[] };
    return (json.items ?? []).map((e) => {
      const start = e.start?.dateTime ?? e.start?.date ?? '';
      const end = e.end?.dateTime ?? e.end?.date ?? null;
      return {
        id: e.id,
        title: e.summary ?? '(ללא כותרת)',
        start,
        end,
        allDay: !e.start?.dateTime,
      };
    });
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
