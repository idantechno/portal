import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { CustomerContact } from '../conversations/customer-contact.entity';
import { Appointment } from '../appointments/appointment.entity';
import { WaitlistEntry } from '../appointments/waitlist-entry.entity';
import { Lead } from '../leads/lead.entity';

/**
 * Level-A erasure: permanently delete a single end-customer (or a standalone
 * lead) and all their personal data for one business — the "right to be
 * forgotten" request. All deletes are business-scoped and run in one
 * transaction. There are no DB-level cascades, so children are removed
 * explicitly. Invoices are deliberately NOT touched here: issued invoices carry
 * a legal retention duty and hold only a name snapshot, no contact link.
 */
@Injectable()
export class ContactErasureService {
  constructor(private readonly dataSource: DataSource) {}

  /** Delete a contact plus their conversations, messages, appointments,
   * waitlist entries and any leads that reference them. */
  async eraseContact(businessId: string, contactId: string): Promise<void> {
    const contact = await this.dataSource
      .getRepository(CustomerContact)
      .findOne({
        where: { id: contactId, businessId },
      });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.dataSource.transaction(async (m) => {
      const convs = await m.find(Conversation, {
        where: { businessId, customerContactId: contactId },
        select: { id: true },
      });
      const convIds = convs.map((c) => c.id);
      if (convIds.length > 0) {
        await m.delete(Message, {
          businessId,
          conversationId: In(convIds),
        });
      }
      await m.delete(Conversation, {
        businessId,
        customerContactId: contactId,
      });
      await m.delete(Appointment, { businessId, customerContactId: contactId });
      await m.delete(WaitlistEntry, {
        businessId,
        customerContactId: contactId,
      });
      await m.delete(Lead, { businessId, customerContactId: contactId });
      await m.delete(CustomerContact, { id: contactId, businessId });
    });
  }

  /** Delete a single lead (standalone PII — e.g. a questionnaire submission). */
  async eraseLead(businessId: string, leadId: string): Promise<void> {
    const res = await this.dataSource
      .getRepository(Lead)
      .delete({ id: leadId, businessId });
    if (!res.affected) throw new NotFoundException('Lead not found');
  }
}
