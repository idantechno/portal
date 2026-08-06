import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/appointment.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../integrations/calendar.service';

/** How long a due-dated task is treated as occupying the owner's time. */
const TASK_BUSY_MINUTES = 30;

export type BusySource = 'appointment' | 'task' | 'calendar';

export interface BusyInterval {
  start: Date;
  end: Date;
  source: BusySource;
  title: string;
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
  ) {}

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
        out.push({
          start,
          end: new Date(start.getTime() + TASK_BUSY_MINUTES * 60_000),
          source: 'task',
          title: t.title,
        });
      }
    } catch (err) {
      this.log.warn(`[schedule] task busy lookup failed: ${(err as Error).message}`);
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
   * Does [startAt, endAt) collide with anything on the owner's timeline?
   * `excludeAppointmentId` ignores that appointment (for reschedules).
   */
  async hasConflict(
    businessId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    // Widen the window backwards by a task block so a task starting just before
    // the slot is still considered.
    const from = new Date(startAt.getTime() - TASK_BUSY_MINUTES * 60_000);
    const busy = await this.busyIntervals(
      businessId,
      from,
      endAt,
      excludeAppointmentId,
    );
    return busy.some((b) => b.start < endAt && b.end > startAt);
  }
}
