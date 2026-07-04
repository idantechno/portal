import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { SupportRequest, SupportRequestStatus } from './support-request.entity';

export interface CreateSupportRequestInput {
  businessId: string;
  createdByUserId?: string | null;
  subject: string;
  details: string;
}

/** A support request enriched with the requesting business's name for the admin list. */
export interface SupportRequestView extends SupportRequest {
  businessName: string | null;
}

@Injectable()
export class SupportRequestsService {
  constructor(
    @InjectRepository(SupportRequest)
    private readonly requests: Repository<SupportRequest>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  create(input: CreateSupportRequestInput): Promise<SupportRequest> {
    return this.requests.save(
      this.requests.create({
        businessId: input.businessId,
        createdByUserId: input.createdByUserId ?? null,
        subject: input.subject.trim().slice(0, 255),
        details: input.details.trim(),
        status: 'open',
      }),
    );
  }

  /** Cross-tenant list for platform staff, newest first, with business names. */
  async listAll(status?: SupportRequestStatus): Promise<SupportRequestView[]> {
    const rows = await this.requests.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (rows.length === 0) return [];
    const ids = [...new Set(rows.map((r) => r.businessId))];
    const bizList = await this.businesses.find({ where: { id: In(ids) } });
    const nameById = new Map(bizList.map((b) => [b.id, b.name]));
    return rows.map((r) => ({
      ...r,
      businessName: nameById.get(r.businessId) ?? null,
    }));
  }

  openCount(): Promise<number> {
    return this.requests.count({ where: { status: 'open' } });
  }

  async resolve(id: string): Promise<SupportRequest> {
    const row = await this.requests.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Support request not found');
    row.status = 'resolved';
    row.resolvedAt = new Date();
    return this.requests.save(row);
  }
}
