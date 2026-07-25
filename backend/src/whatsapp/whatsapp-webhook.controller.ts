import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Channel } from '../common/enums/channel.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
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
    // Coexistence: messages the owner sent from the WhatsApp Business app,
    // mirrored to us so we can pause the agent and keep the thread in sync.
    // Arrives under field "smb_message_echoes".
    message_echoes?: Array<{
      from?: string;
      to?: string;
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

// Never rate-limit Meta's webhook — Meta batches deliveries and disables the
// subscription on repeated non-2xx. The HMAC signature is the gate here.
@SkipThrottle()
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
      // Log only non-sensitive facts. Never log the expected HMAC (it would let
      // anyone with log access forge a valid signature for this exact body),
      // the secret length, or attacker-controlled body content.
      this.log.warn(
        `Bad signature on inbound webhook (phone_number_id=${phoneNumberId ?? 'none'}) ` +
          `rawLen=${raw.length} sigHeader=${signature ? 'present' : 'MISSING'}`,
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

  // 360dialog forwards Meta-format payloads but does NOT sign them with Meta's
  // app secret, so there is no x-hub-signature-256 to verify. Authentication is
  // the per-business HMAC token baked into the URL we hand to 360dialog; a valid
  // token both proves the caller is 360dialog (holds our secret) and names the
  // tenant to route to — no phone_number_id lookup needed.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('360dialog/:businessId')
  async receive360dialog(
    @Param('businessId') businessId: string,
    @Query('token') token: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: true }> {
    if (!this.conns.verifyWebhookToken(businessId, token ?? '')) {
      throw new ForbiddenException('invalid webhook token');
    }
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException('Missing raw body');
    }
    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(raw.toString('utf8')) as MetaWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    const phoneNumberId = extractPhoneNumberId(payload);
    await this.events.log({
      businessId,
      rawPayload: payload as unknown as Record<string, unknown>,
      signatureOk: true,
      error: null,
    });
    if (phoneNumberId) {
      await this.conns
        .capturePhoneNumberId(businessId, phoneNumberId)
        .catch(() => undefined);
    }

    await this.handleVerifiedPayload(businessId, payload);
    return { ok: true };
  }

  private async handleVerifiedPayload(
    businessId: string,
    payload: MetaWebhookPayload,
  ): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        // Inbound customer messages.
        const displayName = value.contacts?.[0]?.profile?.name ?? null;
        for (const msg of value.messages ?? []) {
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

        // Coexistence: the owner replied to a customer from the WhatsApp
        // Business app. Mirror it into the thread and pause the agent so it
        // won't also reply.
        for (const echo of value.message_echoes ?? []) {
          if (!echo.to || !echo.id) continue;
          try {
            await this.ingestOwnerEcho({
              businessId,
              wamid: echo.id,
              toPhone: echo.to,
              type: echo.type,
              text: echo.text?.body,
            });
          } catch (err) {
            this.log.error(
              `Failed to ingest owner echo ${echo.id} for business ${businessId}: ${(err as Error).message}`,
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

  private async ingestOwnerEcho(input: {
    businessId: string;
    wamid: string;
    toPhone: string;
    type?: string;
    text?: string;
  }): Promise<void> {
    const contact = await this.contacts.upsert({
      businessId: input.businessId,
      channel: Channel.WhatsApp,
      externalId: input.toPhone,
      displayName: null,
      phone: input.toPhone,
    });
    const conversation = await this.conversations.findOrCreate({
      businessId: input.businessId,
      channel: Channel.WhatsApp,
      externalThreadId: input.toPhone,
      customerContactId: contact.id,
    });

    // De-dupe by echo id (also guards against our own API sends echoing back).
    const existing = await this.conversations.findMessageByExternalId(
      input.businessId,
      input.wamid,
    );
    if (existing) return;

    // The owner is handling this conversation by hand — pause the agent so it
    // won't also reply. Mirrors the cockpit behaviour (a manual reply = takeover).
    if (conversation.status !== ConversationStatus.Human) {
      await this.conversations.setStatus(
        input.businessId,
        conversation.id,
        ConversationStatus.Human,
        null,
      );
    }

    // Record the owner's message (already delivered from the app — do NOT
    // re-dispatch). Non-text echoes are stored as a short placeholder.
    const content = input.text ?? `[${input.type ?? 'message'}]`;
    await this.conversations.appendMessage({
      businessId: input.businessId,
      conversationId: conversation.id,
      role: MessageRole.Agent,
      content,
      externalMessageId: input.wamid,
      agentUserId: null,
    });
  }
}
