import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { CalendarService } from '../integrations/calendar.service';
import { GmailService } from '../integrations/gmail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';
import { WaitlistService } from './waitlist.service';

export interface BookAppointmentInput {
  businessId: string;
  customerContactId?: string | null;
  conversationId?: string | null;
  title: string;
  startAt: Date;
  endAt: Date;
  customerName?: string | null;
  phone?: string | null;
  notes?: string | null;
  source?: 'agent' | 'manual';
}

/** Formats an instant as Israel wall-clock time for owner-facing text. */
function israelTime(at: Date): string {
  return at.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * WhatsApp rejects template parameters containing newlines, tabs, or 4+
 * consecutive spaces. Collapse any whitespace run to a single space and trim.
 */
function sanitizeTemplateParam(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

@Injectable()
export class AppointmentsService {
  private readonly log = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    private readonly calendar: CalendarService,
    private readonly gmail: GmailService,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
    private readonly whatsapp: WhatsappConnectionsService,
    private readonly waitlist: WaitlistService,
  ) {}

  /**
   * True if a scheduled appointment already overlaps [start, end). Used to stop
   * the agent double-booking a slot — cancelled/completed ones don't block.
   */
  async hasConflict(
    businessId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const rows = await this.appointments.find({
      where: { businessId, status: AppointmentStatus.Scheduled },
    });
    return rows.some(
      (a) => a.id !== excludeId && a.startAt < endAt && a.endAt > startAt,
    );
  }

  /**
   * Books an appointment: persists the row, mirrors it into Google Calendar
   * (best-effort — a missing/failing calendar never blocks the booking), and
   * rings the owner (in-app now; WhatsApp once a template is wired).
   */
  async book(input: BookAppointmentInput): Promise<Appointment> {
    const appointment = this.appointments.create({
      businessId: input.businessId,
      customerContactId: input.customerContactId ?? null,
      conversationId: input.conversationId ?? null,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      customerName: input.customerName ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      status: AppointmentStatus.Scheduled,
      source: input.source ?? 'agent',
    });

    // Mirror to Google Calendar when connected. Best-effort: the appointment is
    // the source of truth, so a calendar hiccup must not lose the booking.
    try {
      if (await this.calendar.isConnected(input.businessId)) {
        const event = await this.calendar.createEvent(input.businessId, {
          title: input.title,
          start: input.startAt.toISOString(),
          end: input.endAt.toISOString(),
        });
        appointment.calendarEventId = event.id;
      }
    } catch (err) {
      this.log.error(
        `[appointments] calendar mirror failed for business ${input.businessId}: ${(err as Error).message}`,
      );
    }

    const saved = await this.appointments.save(appointment);
    await this.notifyOwner(saved);
    // If this customer was waiting for a slot, their request is now fulfilled.
    await this.waitlist.markBookedForContact(
      saved.businessId,
      saved.customerContactId,
    );
    return saved;
  }

  private async notifyOwner(appointment: Appointment): Promise<void> {
    const who = appointment.customerName ?? appointment.phone ?? 'לקוח';
    const when = israelTime(appointment.startAt);

    // Always ring the in-app bell — works immediately, no external setup.
    try {
      await this.notifications.notify({
        businessId: appointment.businessId,
        type: 'appointment',
        title: `נקבעה פגישה: ${who}`,
        body: `${appointment.title} — ${when}`,
        link: '/calendar',
      });
    } catch (err) {
      this.log.error(
        `[appointments] owner in-app notification failed: ${(err as Error).message}`,
      );
    }

    const business = await this.businesses.findById(appointment.businessId);

    // Email the owner via the business's connected Gmail — a reliable channel
    // that doesn't depend on WhatsApp's messaging window. Best-effort: skipped
    // silently if Gmail isn't connected or the owner has no email on file.
    try {
      const owner = business?.ownerUserId
        ? await this.users.findById(business.ownerUserId)
        : null;
      if (owner?.email) {
        await this.gmail.sendEmail(appointment.businessId, {
          to: owner.email,
          subject: `נקבעה פגישה חדשה — ${who}`,
          body:
            `נקבעה פגישה חדשה במערכת:\n\n` +
            `• פרטים: ${appointment.title}\n` +
            `• לקוח: ${who}\n` +
            (appointment.phone ? `• טלפון: ${appointment.phone}\n` : '') +
            `• מועד: ${when}\n` +
            (appointment.notes ? `• הערות: ${appointment.notes}\n` : ''),
        });
      }
    } catch (err) {
      this.log.warn(
        `[appointments] owner email alert not sent (likely Gmail not ` +
          `connected): ${(err as Error).message}`,
      );
    }

    // Also ring the owner's private WhatsApp, if they've set a number. Prefer the
    // approved `appointment_booked` UTILITY template — it delivers even outside
    // the 24h service window (a cold owner alert). If the template send is
    // rejected (e.g. Meta hasn't approved it yet), fall back to free-form text,
    // which still lands if the owner messaged the business in the last 24h.
    // Best-effort throughout — never let an alert failure break the booking.
    try {
      const ownerPhone = business?.ownerPhone?.trim();
      if (ownerPhone) {
        const eventLine = sanitizeTemplateParam(
          `${appointment.title} — ${when}`,
        );
        const customerParam = sanitizeTemplateParam(who);
        try {
          await this.whatsapp.sendTemplate(appointment.businessId, ownerPhone, {
            name: 'appointment_booked',
            languageCode: 'he',
            bodyParams: [eventLine, customerParam],
          });
        } catch (tplErr) {
          this.log.warn(
            `[appointments] owner WhatsApp template not delivered, trying ` +
              `free-form: ${(tplErr as Error).message}`,
          );
          await this.whatsapp.sendText(
            appointment.businessId,
            ownerPhone,
            `נקבעה פגישה חדשה 📅\n${appointment.title}\nלקוח: ${who}\nמועד: ${when}`,
          );
        }
      }
    } catch (err) {
      this.log.warn(
        `[appointments] owner WhatsApp alert not delivered (likely no ` +
          `connection or outside 24h window): ${(err as Error).message}`,
      );
    }
  }

  list(
    businessId: string,
    opts: { from?: Date; to?: Date; status?: AppointmentStatus } = {},
  ): Promise<Appointment[]> {
    const where: Record<string, unknown> = { businessId };
    if (opts.status) where.status = opts.status;
    if (opts.from && opts.to) where.startAt = Between(opts.from, opts.to);
    return this.appointments.find({
      where,
      order: { startAt: 'ASC' },
      take: 500,
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Appointment> {
    const row = await this.appointments.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Appointment not found');
    return row;
  }

  /** A contact's future, still-scheduled appointments — what the agent shows. */
  listUpcomingForContact(
    businessId: string,
    contactId: string,
  ): Promise<Appointment[]> {
    return this.appointments.find({
      where: {
        businessId,
        customerContactId: contactId,
        status: AppointmentStatus.Scheduled,
        startAt: MoreThanOrEqual(new Date()),
      },
      order: { startAt: 'ASC' },
      take: 50,
    });
  }

  /** Loads an appointment and asserts it belongs to this contact. */
  private async requireOwned(
    businessId: string,
    contactId: string,
    appointmentId: string,
  ): Promise<Appointment> {
    const appointment = await this.findByIdScoped(businessId, appointmentId);
    if (appointment.customerContactId !== contactId) {
      // The agent must never touch another customer's appointment.
      throw new ForbiddenException(
        'Appointment does not belong to this contact',
      );
    }
    return appointment;
  }

  /**
   * Cancels an appointment on the customer's own behalf (agent-driven), after
   * verifying it's theirs. Frees the slot to the waitlist, same as an operator
   * cancel.
   */
  async cancelForContact(
    businessId: string,
    contactId: string,
    appointmentId: string,
  ): Promise<Appointment> {
    await this.requireOwned(businessId, contactId, appointmentId);
    return this.cancel(businessId, appointmentId);
  }

  /**
   * Moves a customer's own appointment to a new time: books the new slot (after
   * a conflict check) and frees the old one to the waitlist. Verifies ownership.
   */
  async rescheduleForContact(
    businessId: string,
    contactId: string,
    appointmentId: string,
    newStart: Date,
    newEnd: Date,
  ): Promise<Appointment> {
    const old = await this.requireOwned(businessId, contactId, appointmentId);
    if (old.status !== AppointmentStatus.Scheduled) {
      throw new BadRequestException('Appointment is not active');
    }
    if (await this.hasConflict(businessId, newStart, newEnd, appointmentId)) {
      throw new BadRequestException('SLOT_TAKEN');
    }
    const moved = await this.book({
      businessId,
      customerContactId: contactId,
      conversationId: old.conversationId,
      title: old.title,
      startAt: newStart,
      endAt: newEnd,
      customerName: old.customerName,
      phone: old.phone,
      notes: old.notes,
      source: 'agent',
    });
    await this.cancel(businessId, old.id);
    return moved;
  }

  /**
   * Cancels an appointment and frees its slot: the waitlist is scanned for the
   * next customer whose window fits, and they're offered the opening. The
   * calendar mirror is left in place (informational) — the DB row is the source
   * of truth for availability.
   */
  async cancel(businessId: string, id: string): Promise<Appointment> {
    const appointment = await this.findByIdScoped(businessId, id);
    appointment.status = AppointmentStatus.Cancelled;
    const saved = await this.appointments.save(appointment);
    // Offer the freed slot: first to the waitlist; if no one is waiting, invite
    // an existing customer with a later appointment to move earlier. Best-effort.
    // Never offer the slot back to the customer who just vacated it — after a
    // reschedule their own new (later) appointment must not be pulled back into
    // the slot they just left.
    try {
      const excludeContactId = saved.customerContactId;
      const offered = await this.waitlist.offerForFreedSlot(
        businessId,
        saved.startAt,
        excludeContactId,
      );
      if (!offered) {
        await this.offerEarlierToLaterCustomer(
          businessId,
          saved.startAt,
          excludeContactId,
        );
      }
    } catch (err) {
      this.log.error(
        `[appointments] freed-slot offer failed: ${(err as Error).message}`,
      );
    }
    return saved;
  }

  /**
   * With no one on the waitlist, find the nearest customer whose appointment is
   * LATER than the freed slot and would fit it, and offer them the earlier time.
   */
  private async offerEarlierToLaterCustomer(
    businessId: string,
    freedStart: Date,
    excludeContactId?: string | null,
  ): Promise<void> {
    if (freedStart.getTime() < Date.now()) return; // never offer a past slot
    const candidates = await this.appointments.find({
      where: {
        businessId,
        status: AppointmentStatus.Scheduled,
        startAt: MoreThan(freedStart),
      },
      order: { startAt: 'ASC' },
      take: 10,
    });
    for (const c of candidates) {
      if (!c.customerContactId) continue;
      // Skip the customer who freed this slot — don't offer someone the very
      // opening they just created by moving/cancelling their appointment.
      if (excludeContactId && c.customerContactId === excludeContactId)
        continue;
      const duration = c.endAt.getTime() - c.startAt.getTime();
      const end = new Date(freedStart.getTime() + duration);
      // The freed slot must actually fit their appointment length.
      if (await this.hasConflict(businessId, freedStart, end, c.id)) continue;
      await this.waitlist.offerMoveEarlier(businessId, freedStart, c);
      return;
    }
  }

  async setStatus(
    businessId: string,
    id: string,
    status: AppointmentStatus,
  ): Promise<Appointment> {
    const appointment = await this.findByIdScoped(businessId, id);
    appointment.status = status;
    return this.appointments.save(appointment);
  }
}
