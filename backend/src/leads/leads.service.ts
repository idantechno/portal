import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationsService } from '../automations/automations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Lead, LeadSource } from './lead.entity';

export interface CreateLeadInput {
  businessId: string;
  // Only the agent path supplies these; a questionnaire lead has neither.
  conversationId?: string | null;
  customerContactId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  interest: string;
  notes?: string | null;
  source?: LeadSource;
  answers?: Record<string, unknown> | null;
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leads: Repository<Lead>,
    private readonly automations: AutomationsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(input: CreateLeadInput): Promise<Lead> {
    const lead = await this.leads.save(
      this.leads.create({
        businessId: input.businessId,
        conversationId: input.conversationId ?? null,
        customerContactId: input.customerContactId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        interest: input.interest,
        notes: input.notes ?? null,
        source: input.source ?? 'agent',
        answers: input.answers ?? null,
      }),
    );

    // A new lead always rings the cockpit bell, then fires the automation
    // trigger so owner-defined rules can act on it. Both are best-effort and
    // must never fail the capture itself.
    await this.notifications
      .notify({
        businessId: lead.businessId,
        type: 'lead',
        title: `ליד חדש: ${lead.name}`,
        body: lead.interest,
        link: `/app/businesses/${lead.businessId}/leads`,
      })
      .catch(() => undefined);
    await this.automations
      .emit(lead.businessId, 'lead.created', {
        relatedType: 'lead',
        relatedId: lead.id,
        name: lead.name,
        interest: lead.interest,
      })
      .catch(() => undefined);

    return lead;
  }

  list(businessId: string): Promise<Lead[]> {
    return this.leads.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  findByIdScoped(businessId: string, id: string): Promise<Lead | null> {
    return this.leads.findOne({ where: { id, businessId } });
  }

  /** CRM edits: update the free-text notes on a lead (scoped by business). */
  async updateNotes(
    businessId: string,
    id: string,
    notes: string,
  ): Promise<Lead> {
    const lead = await this.leads.findOne({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.notes = notes;
    return this.leads.save(lead);
  }
}
