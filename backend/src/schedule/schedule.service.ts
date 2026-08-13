import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/appointment.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../integrations/calendar.service';
import { BusinessesService } from '../businesses/businesses.service';
import {
  DEFAULT_TASK_DURATION_MINUTES,
  MAX_TASK_DURATION_MINUTES,
} from '../tasks/task.entity';
import {
  availabilityBufferMinutes,
  checkAvailability,
  type AvailabilityCheck,
} from '../common/business-availability';

export type BusySource = 'appointment' | 'task' | 'calendar';

export interface BusyInterval {
  start: Date;
  end: Date;
  source: BusySource;
  title: string;
}

export interface AgendaItem {
  source: BusySource | 'reminder';
  title: string;
  start: string;
  end: string | null;
}

export interface AgendaConflict {
  a: string;
  b: string;
}

export interface FreeSlot {
  /** ISO start of an open slot. */
  start: string;
  /** ISO end of an open slot. */
  end: string;
}

/**
 * The "schedule brain": one unified view of when the owner is busy, merged from
 * every feature that takes time — booked appointments, due-dated to-do tasks,
 * and the owner's Google Calendar. Every scheduling decision (agent bookings,
 * manual bookings, reschedules, waitlist offers) checks conflicts THROUGH here,
 * so no agent or path can double-book or book over the owner's calendar.
 *
 * Google mirrors of our own appointments are de-duplicated (each booked
 * appointment already exists here as an appointment AND as its Google event) so
 * they're never counted twice — and excluding one appointment also excludes its
 * mirror, which is what makes a reschedule not conflict with itself.
 */
@Injectable()
export class ScheduleService {
  private readonly log = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    private readonly tasks: TasksService,
    private readonly calendar: CalendarService,
    private readonly businesses: BusinessesService,
  ) {}

  /**
   * Is [startAt, endAt) inside the business's declared open hours? A business
   * that hasn't set hours (or disabled them) is treated as always open. Used to
   * stop the agent booking outside working hours; the owner's manual bookings
   * bypass this.
   */
  async isWithinAvailability(
    businessId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<AvailabilityCheck> {
    const business = await this.businesses.findById(businessId);
    return checkAvailability(business?.availability, startAt, endAt);
  }

  /**
   * Concrete open appointment slots in [from, to) of the given length —
   * honouring the business's open hours, inter-appointment buffer, and the
   * whole busy timeline (appointments, dated tasks, Google events). Slots land
   * on :00/:30 boundaries so offers read cleanly.
   *
   * Only meaningful once the business has declared hours: with no hours we'd be
   * offering slots around the clock, so `hoursConfigured` is false and the agent
   * asks the customer for a preferred time instead.
   */
  async freeSlots(
    businessId: string,
    from: Date,
    to: Date,
    durationMinutes: number,
    limit = 6,
  ): Promise<{ slots: FreeSlot[]; hoursConfigured: boolean }> {
    const business = await this.businesses.findById(businessId);
    const config = business?.availability ?? null;
    if (!config?.enabled) return { slots: [], hoursConfigured: false };

    const durMs = Math.max(15, durationMinutes) * 60_000;
    const bufferMs = availabilityBufferMinutes(config) * 60_000;

    // Pull the busy timeline once, then test every candidate in memory.
    const busy = await this.busyIntervals(businessId, from, to);

    const GRID_MS = 30 * 60_000; // offer on :00/:30 boundaries
    const now = Date.now();
    // First 30-min grid point at/after max(from, now). Israel's UTC offset is a
    // whole number of hours, so a UTC grid aligns to local :00/:30.
    let t = Math.ceil(Math.max(from.getTime(), now) / GRID_MS) * GRID_MS;
    const end = to.getTime();
    const MAX_STEPS = 2000; // bounded scan regardless of how wide the window is

    const slots: FreeSlot[] = [];
    for (
      let i = 0;
      i < MAX_STEPS && t + durMs <= end && slots.length < limit;
      i++, t += GRID_MS
    ) {
      const s = new Date(t);
      const e = new Date(t + durMs);
      if (!checkAvailability(config, s, e).ok) continue;
      // Reject a candidate that lands within the buffer of any busy block.
      const clash = busy.some(
        (b) =>
          b.start.getTime() - bufferMs < e.getTime() &&
          b.end.getTime() + bufferMs > s.getTime(),
      );
      if (clash) continue;
      slots.push({ start: s.toISOString(), end: e.toISOString() });
    }
    return { slots, hoursConfigured: true };
  }

  /**
   * All busy blocks overlapping [from, to). `excludeAppointmentId` drops that
   * appointment AND its Google mirror (so a reschedule doesn't clash with the
   * slot it's moving out of).
   */
  async busyIntervals(
    businessId: string,
    from: Date,
    to: Date,
    excludeAppointmentId?: string,
  ): Promise<BusyInterval[]> {
    const out: BusyInterval[] = [];

    // Appointments (source of truth). Collect every mirror id so the Google
    // pass can skip our own events — including the excluded appointment's.
    const appts = await this.appointments.find({
      where: { businessId, status: AppointmentStatus.Scheduled },
    });
    const ownEventIds = new Set<string>();
    for (const a of appts) {
      if (a.calendarEventId) ownEventIds.add(a.calendarEventId);
      if (a.id === excludeAppointmentId) continue;
      if (a.endAt > from && a.startAt < to) {
        out.push({
          start: a.startAt,
          end: a.endAt,
          source: 'appointment',
          title: a.title,
        });
      }
    }

    // Due-dated to-do tasks → a nominal busy block at the due time.
    try {
      const tasks = await this.tasks.datedInWindow(businessId, from, to);
      for (const t of tasks) {
        if (!t.dueAt) continue;
        const start = new Date(t.dueAt);
        // Each task occupies its own configured length (default 30 min), so a
        // 2-hour task blocks two hours — not a flat half-hour.
        const durationMin = t.durationMinutes ?? DEFAULT_TASK_DURATION_MINUTES;
        out.push({
          start,
          end: new Date(start.getTime() + durationMin * 60_000),
          source: 'task',
          title: t.title,
        });
      }
    } catch (err) {
      this.log.warn(
        `[schedule] task busy lookup failed: ${(err as Error).message}`,
      );
    }

    // Google Calendar (timed events only), skipping our own appointment mirrors.
    try {
      if (await this.calendar.isConnected(businessId)) {
        const events = await this.calendar.listEvents(
          businessId,
          from.toISOString(),
          to.toISOString(),
        );
        for (const ev of events) {
          if (ev.allDay || !ev.start) continue;
          if (ownEventIds.has(ev.id)) continue;
          const start = new Date(ev.start);
          const end = ev.end
            ? new Date(ev.end)
            : new Date(start.getTime() + 60 * 60_000);
          out.push({ start, end, source: 'calendar', title: ev.title });
        }
      }
    } catch (err) {
      // A calendar hiccup must never block scheduling — degrade to DB-only busy.
      this.log.warn(
        `[schedule] calendar busy lookup failed: ${(err as Error).message}`,
      );
    }

    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * A unified agenda for [from, to): every busy block (appointments, dated
   * tasks, calendar) plus reminders (nudges), sorted by time — and the pairs of
   * busy blocks that overlap, so the UI can flag an over-booked day. Powers the
   * daily review.
   */
  async agenda(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<{ items: AgendaItem[]; conflicts: AgendaConflict[] }> {
    const busy = await this.busyIntervals(businessId, from, to);
    const items: AgendaItem[] = busy.map((b) => ({
      source: b.source,
      title: b.title,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
    }));

    // Reminders are deliberately NOT part of the schedule/agenda. They are pure
    // nudges (don't forget X / ping a customer), not time on the owner's day, so
    // they live only in the תזכורות list — never in the יומן/לו״ז view.

    items.sort((a, b) => a.start.localeCompare(b.start));

    // Overlapping busy blocks = a clash worth surfacing.
    const conflicts: AgendaConflict[] = [];
    for (let i = 0; i < busy.length; i++) {
      for (let j = i + 1; j < busy.length; j++) {
        if (busy[i].start < busy[j].end && busy[i].end > busy[j].start) {
          conflicts.push({ a: busy[i].title, b: busy[j].title });
        }
      }
    }
    return { items, conflicts };
  }

  /**
   * Does [startAt, endAt) collide with anything on the owner's timeline?
   * `excludeAppointmentId` ignores that appointment (for reschedules).
   */
  async hasConflict(
    businessId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    // Enforce the business's inter-appointment buffer by treating the requested
    // slot as if it were `buffer` minutes wider on each side — so two bookings
    // can't sit back-to-back when the owner wants breathing room between them.
    const business = await this.businesses.findById(businessId);
    const bufferMs = availabilityBufferMinutes(business?.availability) * 60_000;
    const guardedStart = new Date(startAt.getTime() - bufferMs);
    const guardedEnd = new Date(endAt.getTime() + bufferMs);

    // Widen the query window backwards by the longest a task can run, so a long
    // task starting well before the (buffered) slot is still fetched and its
    // overlap counted.
    const from = new Date(
      guardedStart.getTime() - MAX_TASK_DURATION_MINUTES * 60_000,
    );
    const busy = await this.busyIntervals(
      businessId,
      from,
      guardedEnd,
      excludeAppointmentId,
    );
    return busy.some((b) => b.start < guardedEnd && b.end > guardedStart);
  }
}
