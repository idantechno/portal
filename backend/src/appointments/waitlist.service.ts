import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistEntry } from './waitlist-entry.entity';
import { WaitlistStatus } from '../common/enums/waitlist-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { MessageRole } from '../common/enums/message-role.enum';

export interface JoinWaitlistInput {
  businessId: string;
  customerContactId?: string | null;
  conversationId?: string | null;
  service: string;
  customerName?: string | null;
  phone?: string | null;
  preferredFrom?: Date | null;
  preferredTo?: Date | null;
  notes?: string | null;
}

/** Israel wall-clock rendering for customer/owner-facing text. */
function israelTime(at: Date): string {
  return at.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class WaitlistService {
  private readonly log = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlist: Repository<WaitlistEntry>,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappConnectionsService,
    private readonly conversations: ConversationsService,
    private readonly channels: ChannelRegistry,
  ) {}

  join(input: JoinWaitlistInput): Promise<WaitlistEntry> {
    return this.waitlist.save(
      this.waitlist.create({
        businessId: input.businessId,
        customerContactId: input.customerContactId ?? null,
        conversationId: input.conversationId ?? null,
        service: input.service,
        customerName: input.customerName ?? null,
        phone: input.phone ?? null,
        preferredFrom: input.preferredFrom ?? null,
        preferredTo: input.preferredTo ?? null,
        notes: input.notes ?? null,
        status: WaitlistStatus.Waiting,
      }),
    );
  }

  list(
    businessId: string,
    opts: { status?: WaitlistStatus } = {},
  ): Promise<WaitlistEntry[]> {
    return this.waitlist.find({
      where: { businessId, ...(opts.status ? { status: opts.status } : {}) },
      order: { createdAt: 'ASC' },
      take: 500,
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<WaitlistEntry> {
    const row = await this.waitlist.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Waitlist entry not found');
    return row;
  }

  async cancel(businessId: string, id: string): Promise<WaitlistEntry> {
    const entry = await this.findByIdScoped(businessId, id);
    entry.status = WaitlistStatus.Cancelled;
    return this.waitlist.save(entry);
  }

  /**
   * The most recent open (offered) slot for a contact — so the agent's prompt
   * can tell it "you offered them X; if they accept, book it". Null if none.
   */
  async findOpenOfferForContact(
    businessId: string,
    customerContactId: string | null,
  ): Promise<WaitlistEntry | null> {
    if (!customerContactId) return null;
    return this.waitlist.findOne({
      where: {
        businessId,
        customerContactId,
        status: WaitlistStatus.Offered,
      },
      order: { offeredAt: 'DESC' },
    });
  }

  /**
   * Marks a contact's open waitlist entry as booked — called after they take a
   * slot, so a fulfilled request stops matching future freed slots.
   */
  async markBookedForContact(
    businessId: string,
    customerContactId: string | null,
  ): Promise<void> {
    if (!customerContactId) return;
    const open = await this.waitlist.find({
      where: [
        {
          businessId,
          customerContactId,
          status: WaitlistStatus.Waiting,
        },
        {
          businessId,
          customerContactId,
          status: WaitlistStatus.Offered,
        },
      ],
    });
    for (const entry of open) {
      entry.status = WaitlistStatus.Booked;
    }
    if (open.length) await this.waitlist.save(open);
  }

  /**
   * A slot [start, end) just opened (an appointment was cancelled). Find the
   * oldest waiting entry whose preferred window contains the slot, offer it to
   * them over WhatsApp, and tell the owner. Best-effort messaging — a failed
   * send still records the offer so the owner can follow up manually.
   */
  async offerForFreedSlot(
    businessId: string,
    slotStart: Date,
    excludeContactId?: string | null,
  ): Promise<WaitlistEntry | null> {
    const waiting = await this.waitlist.find({
      where: { businessId, status: WaitlistStatus.Waiting },
      order: { createdAt: 'ASC' },
    });
    const match = waiting.find(
      (e) =>
        // Don't offer the slot back to the customer who just vacated it.
        (!excludeContactId || e.customerContactId !== excludeContactId) &&
        (!e.preferredFrom || slotStart >= e.preferredFrom) &&
        (!e.preferredTo || slotStart <= e.preferredTo),
    );
    if (!match) return null;

    match.status = WaitlistStatus.Offered;
    match.offeredAt = new Date();
    match.offeredSlotStart = slotStart;
    const saved = await this.waitlist.save(match);

    const when = israelTime(slotStart);
    await this.deliverOffer(
      businessId,
      saved,
      `היי! התפנה תור ל${saved.service} ב${when}. ` +
        `רוצה לתפוס אותו? השיבי "כן" ואשריין לך אותו.`,
    );
    return saved;
  }

  /**
   * No one was on the waitlist for a freed slot — instead invite an existing
   * customer who has a LATER appointment to bring it forward into the opening.
   * Records a "move earlier" offer (with `moveAppointmentId`) so a "כן" reply
   * makes the agent reschedule that appointment, not book a new one.
   */
  async offerMoveEarlier(
    businessId: string,
    slotStart: Date,
    appointment: {
      id: string;
      customerContactId: string | null;
      conversationId: string | null;
      title: string;
      customerName: string | null;
      phone: string | null;
      startAt: Date;
    },
  ): Promise<WaitlistEntry | null> {
    if (!appointment.customerContactId) return null;

    const entry = await this.waitlist.save(
      this.waitlist.create({
        businessId,
        customerContactId: appointment.customerContactId,
        conversationId: appointment.conversationId,
        service: appointment.title,
        customerName: appointment.customerName,
        phone: appointment.phone,
        status: WaitlistStatus.Offered,
        offeredAt: new Date(),
        offeredSlotStart: slotStart,
        moveAppointmentId: appointment.id,
      }),
    );

    await this.deliverOffer(
      businessId,
      entry,
      `היי! התפנה תור מוקדם יותר ל${appointment.title} ב${israelTime(slotStart)} ` +
        `(במקום ${israelTime(appointment.startAt)}). רוצה להקדים? ` +
        `השיבי "כן" ואעביר לך אותו.`,
    );
    return entry;
  }

  /**
   * Delivers an offer to the customer — through their conversation thread when
   * possible (so the agent sees it in context and can close the loop), else a
   * raw WhatsApp send — and rings the owner. Best-effort throughout.
   */
  private async deliverOffer(
    businessId: string,
    entry: WaitlistEntry,
    offerText: string,
  ): Promise<void> {
    let sentViaThread = false;
    if (entry.conversationId) {
      try {
        const conversation = await this.conversations.findByIdScoped(
          businessId,
          entry.conversationId,
        );
        const message = await this.conversations.appendMessage({
          businessId,
          conversationId: conversation.id,
          role: MessageRole.Bot,
          content: offerText,
        });
        await this.channels.dispatch(conversation, message);
        sentViaThread = true;
      } catch (err) {
        this.log.warn(
          `[waitlist] offer via thread failed for ${entry.conversationId}: ${(err as Error).message}`,
        );
      }
    }
    if (!sentViaThread && entry.phone) {
      try {
        await this.whatsapp.sendText(businessId, entry.phone, offerText);
      } catch (err) {
        this.log.warn(
          `[waitlist] offer WhatsApp not delivered to ${entry.phone}: ${(err as Error).message}`,
        );
      }
    }

    const who = entry.customerName ?? entry.phone ?? 'לקוח';
    try {
      await this.notifications.notify({
        businessId,
        type: 'appointment',
        title: `תור התפנה — הוצע ל${who}`,
        body: entry.offeredSlotStart
          ? `${entry.service} — ${israelTime(entry.offeredSlotStart)}`
          : entry.service,
        link: '/appointments',
      });
    } catch (err) {
      this.log.warn(
        `[waitlist] owner notification failed: ${(err as Error).message}`,
      );
    }
  }
}
