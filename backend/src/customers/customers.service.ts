import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { LeadsService } from '../leads/leads.service';
import { CustomerContact } from '../conversations/customer-contact.entity';
import { ContactStatus } from '../common/enums/contact-status.enum';
import { Customer } from './customer.entity';
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
   * Promote a lead into a customer. Copies the lead's identity and keeps the
   * `leadId` link so the questionnaire answers stay reachable (a brief can still
   * be generated for this customer). Idempotent-ish: refuses to create a second
   * customer from the same lead.
   */
  async createFromLead(businessId: string, leadId: string): Promise<Customer> {
    const lead = await this.leads.findByIdScoped(businessId, leadId);
    if (!lead) throw new NotFoundException('Lead not found');

    const existing = await this.customers.findOne({
      where: { businessId, leadId },
    });
    if (existing) {
      throw new BadRequestException('כבר קיים לקוח שנוצר מהליד הזה');
    }

    const businessName =
      (lead.answers as { businessName?: string } | null)?.businessName ?? null;

    const customer = await this.customers.save(
      this.customers.create({
        businessId,
        name: lead.name,
        businessName: businessName?.trim() || null,
        phone: lead.phone,
        email: lead.email,
        notes: lead.notes,
        source: 'lead',
        leadId: lead.id,
        customerContactId: lead.customerContactId,
      }),
    );

    // Adopt any documents already generated from this lead (e.g. a brief made
    // from the leads tab, with customer_id NULL) so they surface under the new
    // customer. Cascades brief → strategy/objective, strategy → plan.
    await this.linkLeadDocuments(businessId, lead.id, customer.id);
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

    const existing = await this.customers.findOne({
      where: { businessId, customerContactId: contactId },
    });
    if (existing) {
      throw new BadRequestException('כבר קיים לקוח שנוצר מאיש הקשר הזה');
    }

    const customer = await this.customers.save(
      this.customers.create({
        businessId,
        name:
          contact.displayName?.trim() || contact.phone || contact.externalId,
        businessName: null,
        phone: contact.phone,
        email: contact.email,
        notes: contact.notes,
        source: 'contact',
        customerContactId: contact.id,
      }),
    );

    // Keep the conversation contact in sync — it's now a paying customer.
    if (contact.status !== ContactStatus.Customer) {
      contact.status = ContactStatus.Customer;
      await this.contacts.save(contact);
    }

    return customer;
  }

  /** Customers list for a business, ordered per the requested sort. */
  async list(
    businessId: string,
    sort: CustomerSort = 'recent',
  ): Promise<Customer[]> {
    const qb = this.customers
      .createQueryBuilder('c')
      .where('c.business_id = :businessId', { businessId });

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
    return this.customers.save(customer);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const customer = await this.findByIdScoped(businessId, id);
    await this.customers.remove(customer);
  }
}
