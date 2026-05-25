import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  create(input: CreateLeadInput): Promise<Lead> {
    return this.leads.save(
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
  }

  list(businessId: string): Promise<Lead[]> {
    return this.leads.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }
}
