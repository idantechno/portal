import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerContact } from './customer-contact.entity';
import { Channel } from '../common/enums/channel.enum';
import { ContactStatus } from '../common/enums/contact-status.enum';
import { CustomersService } from '../customers/customers.service';

export interface UpsertContactInput {
  businessId: string;
  channel: Channel;
  externalId: string;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateContactProfileInput {
  status?: ContactStatus;
  notes?: string | null;
  displayName?: string | null;
}

@Injectable()
export class CustomerContactsService {
  constructor(
    @InjectRepository(CustomerContact)
    private readonly contacts: Repository<CustomerContact>,
    // Resolved lazily (see linkPerson) to avoid a module cycle:
    // ConversationsModule cannot import CustomersModule because Customers
    // depends back on Conversations through the Leads→…→WhatsApp chain.
    private readonly moduleRef: ModuleRef,
  ) {}

  async upsert(input: UpsertContactInput): Promise<CustomerContact> {
    const existing = await this.contacts.findOne({
      where: {
        businessId: input.businessId,
        channel: input.channel,
        externalId: input.externalId,
      },
    });
    if (existing) {
      let changed = false;
      if (input.displayName && existing.displayName !== input.displayName) {
        existing.displayName = input.displayName;
        changed = true;
      }
      if (input.phone && existing.phone !== input.phone) {
        existing.phone = input.phone;
        changed = true;
      }
      if (input.email && existing.email !== input.email) {
        existing.email = input.email;
        changed = true;
      }
      if (input.metadata) {
        existing.metadata = { ...existing.metadata, ...input.metadata };
        changed = true;
      }
      const saved = changed ? await this.contacts.save(existing) : existing;
      await this.linkPerson(saved);
      return saved;
    }
    const created = await this.contacts.save(
      this.contacts.create({
        businessId: input.businessId,
        channel: input.channel,
        externalId: input.externalId,
        displayName: input.displayName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        metadata: input.metadata ?? {},
      }),
    );
    await this.linkPerson(created);
    return created;
  }

  /**
   * Attach an identifiable contact (has a phone or an email) to its canonical
   * `customers` person, creating that person if needed and stamping the
   * contact's reverse `customerId`. **Anonymous web-widget sessions with no
   * phone/email get NO person** — this is what keeps junk anonymous sessions
   * out of the unified people list. Only runs while the contact isn't linked
   * yet, so it's cheap and idempotent (skips on every later message). Fully
   * best-effort: a person-upsert hiccup must never break message intake.
   */
  private async linkPerson(contact: CustomerContact): Promise<void> {
    if (contact.customerId) return;
    const phone = contact.phone?.trim() || null;
    const email = contact.email?.trim() || null;
    if (!phone && !email) return;
    try {
      // Lazy, non-strict lookup — CustomersService lives in a module we can't
      // import here without forming a cycle (see the constructor note).
      const customers = this.moduleRef.get(CustomersService, { strict: false });
      const person = await customers.upsertPerson(contact.businessId, {
        name: contact.displayName?.trim() || phone || email,
        phone,
        email,
        // Mirror the contact's own relationship stage onto the person.
        stage: contact.status,
        source: 'contact',
        customerContactId: contact.id,
      });
      // upsertPerson has already written the reverse link in the DB; reflect it
      // on the in-memory entity we hand back so callers see a consistent row.
      if (person) contact.customerId = person.id;
    } catch {
      // Swallow — the contact (and the inbound message) must still succeed.
    }
  }

  findById(id: string): Promise<CustomerContact | null> {
    return this.contacts.findOne({ where: { id } });
  }

  findByExternalId(
    channel: Channel,
    externalId: string,
  ): Promise<CustomerContact | null> {
    return this.contacts.findOne({ where: { channel, externalId } });
  }

  /**
   * Has this business ever had a web-widget session from `origin` before?
   * Used to alert only the FIRST time a new site starts using the widget,
   * rather than on every session. `origin` is a normalized `scheme://host`.
   */
  async hasWebContactFromOrigin(
    businessId: string,
    origin: string,
  ): Promise<boolean> {
    const count = await this.contacts
      .createQueryBuilder('c')
      .where('c.business_id = :businessId', { businessId })
      .andWhere('c.channel = :channel', { channel: Channel.Web })
      .andWhere("c.metadata ->> 'origin' = :origin", { origin })
      .limit(1)
      .getCount();
    return count > 0;
  }

  /** Scoped lookup — never leak a contact across tenants. */
  async findByIdScoped(
    businessId: string,
    id: string,
  ): Promise<CustomerContact> {
    const contact = await this.contacts.findOne({ where: { id, businessId } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  /** Bulk-load contacts by id, scoped to a business (for list hydration). */
  async findManyScoped(
    businessId: string,
    ids: string[],
  ): Promise<Map<string, CustomerContact>> {
    if (ids.length === 0) return new Map();
    const rows = await this.contacts.find({
      where: { businessId, id: In(ids) },
    });
    return new Map(rows.map((c) => [c.id, c]));
  }

  /**
   * Contacts for the Leads / Customers screens — filtered by relationship
   * status, newest activity first, each annotated with the last time they
   * messaged (across all their conversations).
   */
  async listByStatus(
    businessId: string,
    status: ContactStatus,
  ): Promise<Array<CustomerContact & { lastActivityAt: Date | null }>> {
    const qb = this.contacts
      .createQueryBuilder('c')
      .leftJoin('conversations', 'conv', 'conv.customer_contact_id = c.id')
      .where('c.business_id = :businessId', { businessId })
      .andWhere('c.status = :status', { status })
      .addSelect('MAX(conv.last_message_at)', 'last_activity')
      .groupBy('c.id')
      .orderBy('MAX(conv.last_message_at)', 'DESC', 'NULLS LAST')
      .limit(500);
    const { entities, raw } = await qb.getRawAndEntities();
    return entities.map((c, i) => ({
      ...c,
      lastActivityAt: (raw[i] as { last_activity: Date | null }).last_activity,
    }));
  }

  /**
   * Flips a contact from lead → customer once they've actually become one (e.g.
   * booked an appointment), so the chat agent switches to service mode and the
   * Customers screen picks them up. Idempotent: only promotes rows still marked
   * `lead`, so it never clobbers a manual downgrade or re-fires on a customer.
   */
  async promoteToCustomer(
    businessId: string,
    contactId: string,
  ): Promise<void> {
    await this.contacts.update(
      { id: contactId, businessId, status: ContactStatus.Lead },
      { status: ContactStatus.Customer },
    );
  }

  async updateProfile(
    businessId: string,
    id: string,
    input: UpdateContactProfileInput,
  ): Promise<CustomerContact> {
    const contact = await this.findByIdScoped(businessId, id);
    if (input.status !== undefined) contact.status = input.status;
    if (input.notes !== undefined) contact.notes = input.notes;
    if (input.displayName !== undefined) {
      contact.displayName = input.displayName;
    }
    return this.contacts.save(contact);
  }
}
