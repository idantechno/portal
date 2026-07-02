import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationsService } from '../automations/automations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Lead } from './lead.entity';

export interface CreateLeadInput {
  businessId: string;
  conversationId: string;
  customerContactId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  interest: string;
  notes?: string | null;
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
        conversationId: input.conversationId,
        customerContactId: input.customerContactId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        interest: input.interest,
        notes: input.notes ?? null,
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
}
