import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { LeadsService } from '../leads/leads.service';
import { CustomerContact } from '../conversations/customer-contact.entity';
import { ContactStatus } from '../common/enums/contact-status.enum';
import { Customer, CustomerSource } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerSort } from './dto/list-customers.dto';

/**
 * Reduces a phone number to a comparison key: digits only, last 9 kept — so an
 * E.164 WhatsApp id ("972501234567"), a national form ("0501234567"), and a
 * dashed CRM entry ("050-123-4567") all collapse to the same "501234567". Below
 * 7 digits it's not a real number → no key (never match on a fragment).
 */
function normalizePhoneKey(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-9);
}

/**
 * Everything a caller can offer when finding-or-creating the canonical
 * `customers` "person" for a business. Every field is optional — the helper
 * enriches only the blanks on an existing person and never overwrites a
 * non-null value (the one exception being a lead→customer stage promotion).
 */
export interface UpsertPersonInput {
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Lifecycle stage to move TOWARDS — only ever promotes lead→customer. */
  stage?: ContactStatus;
  source?: CustomerSource;
  sourceDetail?: string | null;
  interest?: string | null;
  notes?: string | null;
  /** Arbitrary structured intake payload (form answers, tool args, UTM, …). */
  capturedData?: Record<string, unknown> | null;
  customerContactId?: string | null;
  leadId?: string | null;
  /**
   * Create a person even when no phone/email is present. Off by default so an
   * anonymous/no-identity caller (e.g. a web-widget session) never spawns a
   * junk row; explicit lead-capture paths turn it on.
   */
  forceCreate?: boolean;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(CustomerContact)
    private readonly contacts: Repository<CustomerContact>,
    private readonly leads: LeadsService,
  ) {}

  /** Create a customer by hand — no lead behind it. */
  async create(businessId: string, dto: CreateCustomerDto): Promise<Customer> {
    return this.customers.save(
      this.customers.create({
        businessId,
        name: dto.name.trim(),
        businessName: dto.businessName?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        notes: dto.notes?.trim() || null,
        source: 'manual',
        nextActivityAt: dto.nextActivityAt
          ? new Date(dto.nextActivityAt)
          : null,
        nextActivityNote: dto.nextActivityNote?.trim() || null,
      }),
    );
  }

  /**
   * THE unification entry point: find-or-create the one canonical `customers`
   * "person" for a business and enrich it, keyed by **normalized phone first,
   * then case-insensitive email** (falling back to an explicit
   * `customerContactId` / `leadId` link when neither identity is given).
   *
   * Rules:
   * - Enrich blanks only — an existing non-null field is NEVER overwritten. The
   *   sole exception is `stage`, which may be PROMOTED lead→customer (never
   *   demoted). A promotion also (re)stamps `becameCustomerAt` to now.
   * - `normalizedPhone` is always kept in sync whenever a phone is present.
   * - `capturedData` accumulates: if the person already has some, the new
   *   payload is appended under `capturedData.history[]` instead of clobbering.
   * - With no phone/email AND no `forceCreate`, an unmatched call creates
   *   nothing and returns `null` (keeps anonymous sessions out of the list).
   * - When `customerContactId` is given, the contact's reverse `customerId`
   *   link is set (only while still NULL) so the thread and the person are one.
   *
   * Additive & transition-safe: callers keep writing their existing lead/contact
   * rows; this just ALSO maintains the unified person alongside them.
   */
  async upsertPerson(
    businessId: string,
    input: UpsertPersonInput,
  ): Promise<Customer | null> {
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim() || null;
    const phoneKey = normalizePhoneKey(phone);
    const emailKey = email?.toLowerCase() || null;

    // Locate the existing person: phone/email identity first, then an explicit
    // contact/lead link (covers identity-less captures that still map to a row).
    let person: Customer | null = null;
    if (phoneKey || emailKey) {
      person = await this.findByPhoneOrEmail(businessId, phone, email);
    }
    if (!person && input.customerContactId) {
      person = await this.customers.findOne({
        where: { businessId, customerContactId: input.customerContactId },
      });
    }
    if (!person && input.leadId) {
      person = await this.customers.findOne({
        where: { businessId, leadId: input.leadId },
      });
    }

    if (!person) {
      // Nothing to enrich — decide whether we're allowed to create at all.
      if (!phoneKey && !emailKey && !input.forceCreate) return null;
      const created = this.customers.create({
        businessId,
        name: input.name?.trim() || phone || email || 'לקוח',
        businessName: input.businessName?.trim() || null,
        phone,
        email,
        normalizedPhone: phoneKey,
        // Undefined lets the column default ('customer') stand.
        stage: input.stage ?? undefined,
        source: input.source ?? 'manual',
        sourceDetail: input.sourceDetail?.trim() || null,
        interest: input.interest?.trim() || null,
        notes: input.notes?.trim() || null,
        capturedData: input.capturedData ?? null,
        customerContactId: input.customerContactId ?? null,
        leadId: input.leadId ?? null,
      });
      person = await this.customers.save(created);
      await this.linkContactToPerson(
        businessId,
        input.customerContactId,
        person.id,
      );
      return person;
    }

    // --- Enrich an existing person: blanks only, never clobber a non-null. ---
    let changed = false;
    const fillBlank = <K extends keyof Customer>(
      field: K,
      value: Customer[K] | null | undefined,
    ): void => {
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        (person![field] === null || person![field] === undefined)
      ) {
        person![field] = value;
        changed = true;
      }
    };

    fillBlank('businessName', input.businessName?.trim() || null);
    fillBlank('interest', input.interest?.trim() || null);
    fillBlank('notes', input.notes?.trim() || null);
    fillBlank('sourceDetail', input.sourceDetail?.trim() || null);
    fillBlank('leadId', input.leadId ?? null);
    fillBlank('customerContactId', input.customerContactId ?? null);

    // Phone / email: fill only when absent, and keep the phone key in step.
    if (phone && !person.phone) {
      person.phone = phone;
      person.normalizedPhone = phoneKey;
      changed = true;
    } else if (person.phone && !person.normalizedPhone) {
      // Backfill a missing key on a row that already carries a phone.
      person.normalizedPhone = normalizePhoneKey(person.phone);
      changed = true;
    }
    if (email && !person.email) {
      person.email = email;
      changed = true;
    }

    // Stage: promote lead→customer only, and mark WHEN they became one. Never
    // demote a customer back to a lead.
    if (
      input.stage === ContactStatus.Customer &&
      person.stage === ContactStatus.Lead
    ) {
      person.stage = ContactStatus.Customer;
      person.becameCustomerAt = new Date();
      changed = true;
    }

    // Captured data accumulates rather than overwrites: keep the first payload
    // in place and push each subsequent one onto capturedData.history[].
    if (input.capturedData) {
      if (!person.capturedData) {
        person.capturedData = input.capturedData;
      } else {
        const existing = person.capturedData;
        const history = Array.isArray(
          (existing as { history?: unknown }).history,
        )
          ? (existing as { history: unknown[] }).history
          : [];
        person.capturedData = {
          ...existing,
          history: [...history, input.capturedData],
        };
      }
      changed = true;
    }

    if (changed) person = await this.customers.save(person);
    await this.linkContactToPerson(
      businessId,
      input.customerContactId,
      person.id,
    );
    return person;
  }

  /**
   * Point a conversation contact at its canonical person — but only while the
   * contact isn't already linked, so we never steal a contact from another
   * person or thrash it on every message.
   */
  private async linkContactToPerson(
    businessId: string,
    contactId: string | null | undefined,
    personId: string,
  ): Promise<void> {
    if (!contactId) return;
    await this.contacts.update(
      { id: contactId, businessId, customerId: IsNull() },
      { customerId: personId },
    );
  }

  /**
   * Promote a lead into a customer. Copies the lead's identity and keeps the
   * `leadId` link so the questionnaire answers stay reachable (a brief can still
   * be generated for this customer). Idempotent-ish: refuses to create a second
   * customer from the same lead.
   */
  async createFromLead(businessId: string, leadId: string): Promise<Customer> {
    const lead = await this.leads.findByIdScoped(businessId, leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    const businessName =
      (lead.answers as { businessName?: string } | null)?.businessName ?? null;

    // Route through the unified helper so converting DEDUPES by phone/email and
    // promotes the existing person to `customer` in place (rather than always
    // inserting a second row). Idempotent: a lead already converted just returns
    // the same person, promoted. `forceCreate` guarantees a non-null result.
    const customer = (await this.upsertPerson(businessId, {
      name: lead.name,
      businessName,
      phone: lead.phone,
      email: lead.email,
      notes: lead.notes,
      interest: lead.interest,
      sourceDetail: lead.sourceDetail,
      stage: ContactStatus.Customer,
      source: 'lead',
      leadId: lead.id,
      customerContactId: lead.customerContactId,
      capturedData: lead.answers ?? undefined,
      forceCreate: true,
    }))!;

    // Adopt any documents already generated from this lead (e.g. a brief made
    // from the leads tab, with customer_id NULL) so they surface under the new
    // customer. Cascades brief → strategy/objective, strategy → plan.
    await this.linkLeadDocuments(businessId, lead.id, customer.id);

    // Keep the conversation contact (if any) in sync — they're now a customer.
    // Targeted update so we don't clobber the reverse `customerId` link.
    if (lead.customerContactId) {
      await this.contacts.update(
        {
          id: lead.customerContactId,
          businessId,
          status: ContactStatus.Lead,
        },
        { status: ContactStatus.Customer },
      );
    }
    return customer;
  }

  /** Point a lead's existing documents (and their descendants) at a customer. */
  async findByLeadId(
    businessId: string,
    leadId: string,
  ): Promise<Customer | null> {
    return this.customers.findOne({ where: { businessId, leadId } });
  }

  private async linkLeadDocuments(
    businessId: string,
    leadId: string,
    customerId: string,
  ): Promise<void> {
    const m = this.customers.manager;
    await m.query(
      `UPDATE "briefs" SET "customer_id" = $1 WHERE "lead_id" = $2 AND "business_id" = $3 AND "customer_id" IS NULL`,
      [customerId, leadId, businessId],
    );
    await m.query(
      `UPDATE "strategies" s SET "customer_id" = $1 FROM "briefs" b WHERE s."brief_id" = b."id" AND b."lead_id" = $2 AND s."business_id" = $3 AND s."customer_id" IS NULL`,
      [customerId, leadId, businessId],
    );
    await m.query(
      `UPDATE "plans" p SET "customer_id" = $1 FROM "strategies" s JOIN "briefs" b ON s."brief_id" = b."id" WHERE p."strategy_id" = s."id" AND b."lead_id" = $2 AND p."business_id" = $3 AND p."customer_id" IS NULL`,
      [customerId, leadId, businessId],
    );
    await m.query(
      `UPDATE "objectives" o SET "customer_id" = $1 FROM "briefs" b WHERE o."brief_id" = b."id" AND b."lead_id" = $2 AND o."business_id" = $3 AND o."customer_id" IS NULL`,
      [customerId, leadId, businessId],
    );
  }

  /**
   * Promote a conversation contact (a WhatsApp/web lead) into a customer.
   * Copies its identity, links back via `customerContactId`, and flips the
   * contact's own status to `customer` so the agent that chats with them treats
   * them accordingly. Refuses a second customer from the same contact.
   */
  async createFromContact(
    businessId: string,
    contactId: string,
  ): Promise<Customer> {
    const contact = await this.contacts.findOne({
      where: { id: contactId, businessId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    // Route through the unified helper: dedupe by phone/email, promote the
    // existing person to `customer` in place, and link the contact both ways.
    // Idempotent — a contact already converted returns the same person.
    const customer = (await this.upsertPerson(businessId, {
      name: contact.displayName?.trim() || contact.phone || contact.externalId,
      phone: contact.phone,
      email: contact.email,
      notes: contact.notes,
      stage: ContactStatus.Customer,
      source: 'contact',
      customerContactId: contact.id,
      forceCreate: true,
    }))!;

    // Keep the conversation contact in sync — it's now a paying customer. A
    // targeted update avoids clobbering the reverse `customerId` link that
    // `upsertPerson` just wrote onto this same row.
    if (contact.status !== ContactStatus.Customer) {
      await this.contacts.update(
        { id: contact.id, businessId },
        { status: ContactStatus.Customer },
      );
    }

    return customer;
  }

  /**
   * Customers list for a business, ordered per the requested sort. An optional
   * `stage` filter narrows to a lifecycle stage (lead|customer) for the future
   * unified screen; omitting it returns every row exactly as before.
   */
  async list(
    businessId: string,
    sort: CustomerSort = 'recent',
    stage?: ContactStatus,
  ): Promise<Customer[]> {
    const qb = this.customers
      .createQueryBuilder('c')
      .where('c.business_id = :businessId', { businessId });

    if (stage) {
      qb.andWhere('c.stage = :stage', { stage });
    }

    if (sort === 'alpha') {
      // Sort by the display name — business name first, then contact name.
      qb.orderBy('COALESCE(c.business_name, c.name)', 'ASC');
    } else if (sort === 'next_activity') {
      // Soonest upcoming activity first; customers with none sink to the bottom.
      qb.orderBy('c.next_activity_at', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('c.became_customer_at', 'DESC');
    }

    return qb.limit(500).getMany();
  }

  /** Count customers created at/after `since` — for campaign status tracking. */
  countSince(businessId: string, since: Date): Promise<number> {
    return this.customers.count({
      where: { businessId, becameCustomerAt: MoreThanOrEqual(since) },
    });
  }

  /** Count customers promoted from a lead at/after `since` (leads→customers). */
  countConvertedSince(businessId: string, since: Date): Promise<number> {
    return this.customers.count({
      where: {
        businessId,
        source: 'lead',
        becameCustomerAt: MoreThanOrEqual(since),
      },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<Customer> {
    const customer = await this.customers.findOne({
      where: { id, businessId },
    });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return customer;
  }

  /**
   * Finds a registered customer of this business by phone number, tolerant of
   * formatting (E.164 vs national vs dashed) via a normalized last-9-digit key.
   * Lets the chat agent tell a real customer apart from a cold lead regardless
   * of how the CRM row was typed. Returns the first match, or null.
   *
   * Scans the business's own customer rows in memory — fine at per-tenant scale;
   * revisit with a normalized indexed column if a tenant's list grows large.
   */
  async findByPhone(
    businessId: string,
    phone?: string | null,
  ): Promise<Customer | null> {
    const key = normalizePhoneKey(phone);
    if (!key) return null;
    const rows = await this.customers.find({
      where: { businessId },
      take: 2000,
    });
    return rows.find((c) => normalizePhoneKey(c.phone) === key) ?? null;
  }

  /**
   * Finds an existing customer matching EITHER a normalized phone OR a
   * case-insensitive email — the dedupe key for public intake submissions, so a
   * client who fills a form twice (or is already a customer) isn't registered
   * again. Phone takes priority; email is the fallback. Returns null if neither
   * is present or nothing matches.
   */
  async findByPhoneOrEmail(
    businessId: string,
    phone?: string | null,
    email?: string | null,
  ): Promise<Customer | null> {
    const phoneKey = normalizePhoneKey(phone);
    const emailKey = email?.trim().toLowerCase() || null;
    if (!phoneKey && !emailKey) return null;
    const rows = await this.customers.find({
      where: { businessId },
      take: 2000,
    });
    return (
      rows.find(
        (c) =>
          (phoneKey && normalizePhoneKey(c.phone) === phoneKey) ||
          (emailKey && (c.email?.trim().toLowerCase() ?? null) === emailKey),
      ) ?? null
    );
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findByIdScoped(businessId, id);
    if (dto.name !== undefined) customer.name = dto.name.trim();
    if (dto.businessName !== undefined)
      customer.businessName = dto.businessName?.trim() || null;
    if (dto.phone !== undefined) customer.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) customer.email = dto.email?.trim() || null;
    if (dto.notes !== undefined) customer.notes = dto.notes?.trim() || null;
    if (dto.brandPageReady !== undefined)
      customer.brandPageReady = dto.brandPageReady;
    if (dto.brandPageUrl !== undefined)
      customer.brandPageUrl = dto.brandPageUrl?.trim() || null;
    if (dto.logoReady !== undefined) customer.logoReady = dto.logoReady;
    if (dto.logoUrl !== undefined)
      customer.logoUrl = dto.logoUrl?.trim() || null;
    if (dto.nextActivityAt !== undefined)
      customer.nextActivityAt = dto.nextActivityAt
        ? new Date(dto.nextActivityAt)
        : null;
    if (dto.nextActivityNote !== undefined)
      customer.nextActivityNote = dto.nextActivityNote?.trim() || null;
    if (dto.engagementSummary !== undefined) {
      customer.engagementSummary = dto.engagementSummary?.trim() || null;
      customer.engagementUpdatedAt = new Date();
    }
    // The owner touching the engagement IS the confirmation: an explicit flag
    // wins, but saving an edited summary also approves it in one step.
    if (dto.engagementApproved !== undefined) {
      customer.engagementApproved = dto.engagementApproved;
    } else if (dto.engagementSummary !== undefined) {
      customer.engagementApproved = true;
    }
    return this.customers.save(customer);
  }

  /**
   * The chat agent records what a customer is actually getting (their agreed
   * engagement) straight from the conversation. Always saved as a DRAFT —
   * `engagementApproved` is forced false — so the owner still has to confirm it.
   * Returns whether the text actually changed, so the caller only nudges the
   * owner on a real update and never re-notifies for an identical re-record.
   */
  async recordEngagementByAgent(
    businessId: string,
    customerId: string,
    summary: string,
  ): Promise<{ customer: Customer; changed: boolean }> {
    const customer = await this.findByIdScoped(businessId, customerId);
    const next = summary.trim().slice(0, 2000);
    const current = (customer.engagementSummary ?? '').trim();
    if (!next || next === current) {
      return { customer, changed: false };
    }
    customer.engagementSummary = next;
    customer.engagementApproved = false;
    customer.engagementUpdatedAt = new Date();
    const saved = await this.customers.save(customer);
    return { customer: saved, changed: true };
  }

  async remove(businessId: string, id: string): Promise<void> {
    const customer = await this.findByIdScoped(businessId, id);
    await this.customers.remove(customer);
  }
}
