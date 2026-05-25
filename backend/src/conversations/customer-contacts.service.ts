import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerContact } from './customer-contact.entity';
import { Channel } from '../common/enums/channel.enum';

export interface UpsertContactInput {
  businessId: string;
  channel: Channel;
  externalId: string;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CustomerContactsService {
  constructor(
    @InjectRepository(CustomerContact)
    private readonly contacts: Repository<CustomerContact>,
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
      return changed ? this.contacts.save(existing) : existing;
    }
    return this.contacts.save(
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
}
