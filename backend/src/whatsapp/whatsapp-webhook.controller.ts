import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Channel } from '../common/enums/channel.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomerContactsService } from '../conversations/customer-contacts.service';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappWebhookEventsService } from './whatsapp-webhook-events.service';

interface MetaWebhookChange {
  value?: {
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
    messages?: Array<{
      from?: string;
      id?: string;
      timestamp?: string;
      type?: string;
      text?: { body?: string };
    }>;
  };
  field?: string;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: MetaWebhookChange[] }>;
}

function verifySignature(
  rawBody: Buffer,
  header: string,
  appSecret: string,
): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length);
  const expected = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(provided, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

function extractPhoneNumberId(payload: MetaWebhookPayload): string | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const id = change.value?.metadata?.phone_number_id;
      if (id) return id;
    }
  }
  return null;
}

@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly log = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly conns: WhatsappConnectionsService,
    private readonly contacts: CustomerContactsService,
    private readonly conversations: ConversationsService,
    private readonly events: WhatsappWebhookEventsService,
  ) {}

  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ) {
    const expected = this.cfg.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (!expected) {
      this.log.error('META_WEBHOOK_VERIFY_TOKEN not configured');
      res.status(HttpStatus.SERVICE_UNAVAILABLE).send('not configured');
      return;
    }
    if (mode !== 'subscribe' || !token || !challenge) {
      res.status(HttpStatus.BAD_REQUEST).send('bad request');
      return;
    }
    if (token !== expected) {
      res.status(HttpStatus.FORBIDDEN).send('forbidden');
      return;
    }
    res.status(HttpStatus.OK).type('text/plain').send(challenge);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post()
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ ok: true }> {
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException('Missing raw body');
    }
    const appSecret = this.cfg.get<string>('META_APP_SECRET');
    if (!appSecret) {
      this.log.error('META_APP_SECRET not configured');
      // Ack so Meta doesn't retry forever while we're misconfigured.
      return { ok: true };
    }

    const signatureOk = verifySignature(raw, signature ?? '', appSecret);

    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(raw.toString('utf8')) as MetaWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    const phoneNumberId = extractPhoneNumberId(payload);
    const conn = phoneNumberId
      ? await this.conns.findByPhoneNumberId(phoneNumberId)
      : null;

    await this.events.log({
      businessId: conn?.businessId ?? null,
      rawPayload: payload as unknown as Record<string, unknown>,
      signatureOk,
      error: signatureOk
        ? conn
          ? null
          : phoneNumberId
            ? `no connection for phone_number_id ${phoneNumberId}`
            : 'no phone_number_id in payload'
        : 'signature mismatch',
    });

    if (!signatureOk) {
      this.log.warn(
        `Bad signature on inbound webhook (phone_number_id=${phoneNumberId ?? 'none'})`,
      );
      return { ok: true };
    }

    if (!conn) {
      // Signature is valid but we don't know this number. Ack so Meta stops
      // retrying; this usually means a stale subscription or a race during
      // onboarding.
      return { ok: true };
    }

    await this.handleVerifiedPayload(conn.businessId, payload);
    return { ok: true };
  }

  private async handleVerifiedPayload(
    businessId: string,
    payload: MetaWebhookPayload,
  ): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;
        const contact = value.contacts?.[0];
        const displayName = contact?.profile?.name ?? null;

        for (const msg of value.messages) {
          if (msg.type !== 'text' || !msg.text?.body || !msg.from || !msg.id) {
            continue;
          }
          try {
            await this.ingestTextMessage({
              businessId,
              wamid: msg.id,
              fromPhone: msg.from,
              displayName,
              text: msg.text.body,
            });
          } catch (err) {
            this.log.error(
              `Failed to ingest message ${msg.id} for business ${businessId}: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }

  private async ingestTextMessage(input: {
    businessId: string;
    wamid: string;
    fromPhone: string;
    displayName: string | null;
    text: string;
  }): Promise<void> {
    const contact = await this.contacts.upsert({
      businessId: input.businessId,
      channel: Channel.WhatsApp,
      externalId: input.fromPhone,
      displayName: input.displayName,
      phone: input.fromPhone,
    });
    const conversation = await this.conversations.findOrCreate({
      businessId: input.businessId,
      channel: Channel.WhatsApp,
      externalThreadId: input.fromPhone,
      customerContactId: contact.id,
    });

    // De-dupe by wamid.
    const existing = await this.conversations.findMessageByExternalId(
      input.businessId,
      input.wamid,
    );
    if (existing) {
      this.log.debug(`Skipping duplicate inbound wamid ${input.wamid}`);
      return;
    }

    await this.conversations.appendMessage({
      businessId: input.businessId,
      conversationId: conversation.id,
      role: MessageRole.Customer,
      content: input.text,
      externalMessageId: input.wamid,
    });
  }
}
