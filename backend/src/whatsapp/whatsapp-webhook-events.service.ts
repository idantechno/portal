import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappWebhookEvent } from './whatsapp-webhook-event.entity';

@Injectable()
export class WhatsappWebhookEventsService {
  constructor(
    @InjectRepository(WhatsappWebhookEvent)
    private readonly events: Repository<WhatsappWebhookEvent>,
  ) {}

  log(input: {
    businessId: string | null;
    rawPayload: Record<string, unknown>;
    signatureOk: boolean;
    error?: string | null;
  }): Promise<WhatsappWebhookEvent> {
    return this.events.save(
      this.events.create({
        businessId: input.businessId,
        rawPayload: input.rawPayload,
        signatureOk: input.signatureOk,
        error: input.error ?? null,
      }),
    );
  }
}
