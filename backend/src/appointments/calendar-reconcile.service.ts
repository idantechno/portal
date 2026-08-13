import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { AppointmentsService } from './appointments.service';
import { BusinessesService } from '../businesses/businesses.service';
import { CalendarService } from '../integrations/calendar.service';
import { CALENDAR_RECONCILE_QUEUE } from './calendar-reconcile.constants';

/** How far ahead we reconcile mirrored appointments. */
const HORIZON_DAYS = 30;
/** A start/end within this many ms is "the same time" (no move to apply). */
const DRIFT_TOLERANCE_MS = 60_000;
/** Bound fan-out so a large tenant count can't explode into API calls. */
const MAX_BUSINESSES = 200;
/** Bound per-business work so one busy calendar can't stall the sweep. */
const MAX_APPTS_PER_BUSINESS = 100;

interface ReconcileStats {
  moved: number;
  cancelled: number;
  mirrored: number;
}

/**
 * The read-back half of the two-way Google sync. The write path already mirrors
 * every booking INTO Google; this sweep closes the loop by reading Google back:
 *
 *  - **Google-side delete** → the event a booking mirrors is gone, so we cancel
 *    the appointment here too (which frees the slot to the waitlist).
 *  - **Google-side move** → the event's time changed, so we align the
 *    appointment's time to match.
 *  - **Drift / missing mirror** → a scheduled appointment that never got a
 *    Google event (calendar connected later, or an earlier mirror hiccup) gets
 *    one created now.
 *
 * Runs as a BullMQ repeatable job every 15 minutes. Every step is best-effort
 * and idempotent — a transient Google error leaves the appointment untouched
 * (never assumed deleted), so the sweep is safe to re-run.
 */
@Injectable()
export class CalendarReconcileService implements OnModuleInit {
  private readonly log = new Logger(CalendarReconcileService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    private readonly appointmentsService: AppointmentsService,
    private readonly businesses: BusinessesService,
    private readonly calendar: CalendarService,
    @InjectQueue(CALENDAR_RECONCILE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // BullMQ dedupes repeatable jobs by their repeat options, so re-adding on
    // every boot doesn't stack duplicates.
    try {
      await this.queue.add(
        'sweep',
        {},
        { repeat: { pattern: '*/15 * * * *' }, removeOnComplete: true },
      );
    } catch (err) {
      this.log.error(
        `Failed to schedule calendar-reconcile sweep: ${(err as Error).message}`,
      );
    }
  }

  /** Reconcile every calendar-connected business. Returns totals. */
  async sweep(): Promise<ReconcileStats> {
    const totals: ReconcileStats = { moved: 0, cancelled: 0, mirrored: 0 };
    let businesses: Awaited<ReturnType<BusinessesService['listAll']>>;
    try {
      businesses = await this.businesses.listAll();
    } catch (err) {
      this.log.warn(
        `[reconcile] business list failed: ${(err as Error).message}`,
      );
      return totals;
    }

    for (const business of businesses.slice(0, MAX_BUSINESSES)) {
      let connected = false;
      try {
        connected = await this.calendar.isConnected(business.id);
      } catch {
        connected = false;
      }
      if (!connected) continue;
      try {
        const s = await this.reconcileBusiness(business.id);
        totals.moved += s.moved;
        totals.cancelled += s.cancelled;
        totals.mirrored += s.mirrored;
      } catch (err) {
        // One tenant's calendar hiccup must never stall the others.
        this.log.warn(
          `[reconcile] business ${business.id} failed: ${(err as Error).message}`,
        );
      }
    }

    if (totals.moved || totals.cancelled || totals.mirrored) {
      this.log.log(
        `[reconcile] moved ${totals.moved}, cancelled ${totals.cancelled}, ` +
          `mirrored ${totals.mirrored}`,
      );
    }
    return totals;
  }

  /** Reconcile one business's forward-window scheduled appointments. */
  private async reconcileBusiness(businessId: string): Promise<ReconcileStats> {
    const stats: ReconcileStats = { moved: 0, cancelled: 0, mirrored: 0 };
    const now = new Date();
    const horizon = new Date(
      now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000,
    );

    const appts = await this.appointments.find({
      where: {
        businessId,
        status: AppointmentStatus.Scheduled,
        startAt: Between(now, horizon),
      },
      order: { startAt: 'ASC' },
      take: MAX_APPTS_PER_BUSINESS,
    });

    for (const appt of appts) {
      // No mirror yet → create one (fixes drift from a late calendar connect).
      if (!appt.calendarEventId) {
        try {
          const event = await this.calendar.createEvent(businessId, {
            title: appt.title,
            start: appt.startAt.toISOString(),
            end: appt.endAt.toISOString(),
          });
          appt.calendarEventId = event.id;
          await this.appointments.save(appt);
          stats.mirrored += 1;
        } catch (err) {
          this.log.warn(
            `[reconcile] mirror create failed for ${appt.id}: ${(err as Error).message}`,
          );
        }
        continue;
      }

      const lookup = await this.calendar.getEvent(
        businessId,
        appt.calendarEventId,
      );
      if (lookup.status === 'error') continue; // unknown → leave it alone

      if (lookup.status === 'deleted') {
        // Honour the Google-side delete: cancel here too (frees the slot to the
        // waitlist). cancel() is idempotent on an already-cancelled row.
        try {
          await this.appointmentsService.cancel(businessId, appt.id);
          stats.cancelled += 1;
        } catch (err) {
          this.log.warn(
            `[reconcile] cancel failed for ${appt.id}: ${(err as Error).message}`,
          );
        }
        continue;
      }

      // status 'ok' → honour a Google-side time move. Ignore all-day edits (we
      // never want to turn a timed appointment into an all-day one).
      const ev = lookup.event;
      if (ev.allDay || !ev.start) continue;
      const newStart = new Date(ev.start);
      const newEnd = ev.end
        ? new Date(ev.end)
        : new Date(newStart.getTime() + 60 * 60_000);
      if (isNaN(newStart.getTime())) continue;

      const moved =
        Math.abs(newStart.getTime() - appt.startAt.getTime()) >
          DRIFT_TOLERANCE_MS ||
        Math.abs(newEnd.getTime() - appt.endAt.getTime()) > DRIFT_TOLERANCE_MS;
      if (moved) {
        try {
          appt.startAt = newStart;
          appt.endAt = newEnd;
          await this.appointments.save(appt);
          stats.moved += 1;
        } catch (err) {
          this.log.warn(
            `[reconcile] move apply failed for ${appt.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    return stats;
  }
}
