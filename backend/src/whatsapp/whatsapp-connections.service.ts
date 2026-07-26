import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { WhatsappConnection } from './whatsapp-connection.entity';

export interface WhatsappConnectionPublic {
  id: string;
  businessId: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  metaBusinessId: string | null;
  displayPhoneNumber: string | null;
  status: WhatsappConnection['status'];
  lastError: string | null;
  connectedAt: Date | null;
  hasAccessToken: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappConnectInput {
  businessId: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber?: string | null;
  metaBusinessId?: string | null;
  accessToken: string;
}

@Injectable()
export class WhatsappConnectionsService {
  private readonly log = new Logger(WhatsappConnectionsService.name);

  constructor(
    @InjectRepository(WhatsappConnection)
    private readonly connections: Repository<WhatsappConnection>,
    private readonly crypto: CryptoService,
    private readonly cfg: ConfigService,
  ) {}

  toPublic(c: WhatsappConnection): WhatsappConnectionPublic {
    return {
      id: c.id,
      businessId: c.businessId,
      phoneNumberId: c.phoneNumberId,
      wabaId: c.wabaId,
      metaBusinessId: c.metaBusinessId,
      displayPhoneNumber: c.displayPhoneNumber,
      status: c.status,
      lastError: c.lastError,
      connectedAt: c.connectedAt,
      hasAccessToken: Boolean(c.accessTokenEncrypted),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  findByBusinessId(businessId: string): Promise<WhatsappConnection | null> {
    return this.connections.findOne({ where: { businessId } });
  }

  findByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsappConnection | null> {
    return this.connections.findOne({ where: { phoneNumberId } });
  }

  /**
   * Called after Embedded Signup completes. Persists the WABA / phone number
   * IDs and the access token Meta granted us for this business. Tokens are
   * AES-GCM encrypted at rest.
   */
  async connect(input: WhatsappConnectInput): Promise<WhatsappConnection> {
    const phoneConflict = await this.connections.findOne({
      where: { phoneNumberId: input.phoneNumberId },
    });
    if (phoneConflict && phoneConflict.businessId !== input.businessId) {
      throw new ConflictException(
        'This WhatsApp number is already connected to another business',
      );
    }

    let conn = await this.findByBusinessId(input.businessId);
    if (!conn) {
      conn = this.connections.create({
        businessId: input.businessId,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        metaBusinessId: input.metaBusinessId ?? null,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        accessTokenEncrypted: this.crypto.encrypt(input.accessToken),
        status: 'active',
        lastError: null,
        connectedAt: new Date(),
      });
    } else {
      conn.phoneNumberId = input.phoneNumberId;
      conn.wabaId = input.wabaId;
      conn.metaBusinessId = input.metaBusinessId ?? conn.metaBusinessId;
      conn.displayPhoneNumber =
        input.displayPhoneNumber ?? conn.displayPhoneNumber;
      conn.accessTokenEncrypted = this.crypto.encrypt(input.accessToken);
      conn.status = 'active';
      conn.lastError = null;
      conn.connectedAt = new Date();
    }
    return this.connections.save(conn);
  }

  /**
   * Connect a business through our 360dialog BSP. Unlike Meta Embedded Signup,
   * there is no OAuth token — the operator provides the per-number 360dialog API
   * key (stored encrypted, reusing accessTokenEncrypted). phone_number_id is not
   * required for routing (inbound is routed by the signed webhook URL, outbound
   * by the API key); it is captured opportunistically from the first webhook.
   */
  async connect360dialog(input: {
    businessId: string;
    apiKey: string;
    wabaId?: string | null;
    displayPhoneNumber?: string | null;
    metaBusinessId?: string | null;
  }): Promise<WhatsappConnection> {
    let conn = await this.findByBusinessId(input.businessId);
    if (!conn) {
      conn = this.connections.create({
        businessId: input.businessId,
        phoneNumberId: null,
        wabaId: input.wabaId ?? null,
        metaBusinessId: input.metaBusinessId ?? null,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        accessTokenEncrypted: this.crypto.encrypt(input.apiKey),
        status: 'active',
        lastError: null,
        connectedAt: new Date(),
      });
    } else {
      conn.wabaId = input.wabaId ?? conn.wabaId;
      conn.metaBusinessId = input.metaBusinessId ?? conn.metaBusinessId;
      conn.displayPhoneNumber =
        input.displayPhoneNumber ?? conn.displayPhoneNumber;
      conn.accessTokenEncrypted = this.crypto.encrypt(input.apiKey);
      conn.status = 'active';
      conn.lastError = null;
      conn.connectedAt = new Date();
    }
    return this.connections.save(conn);
  }

  /**
   * Store the Meta phone_number_id seen on an inbound 360dialog webhook, once,
   * for bookkeeping. No-op if already set or if another connection owns it.
   */
  async capturePhoneNumberId(
    businessId: string,
    phoneNumberId: string,
  ): Promise<void> {
    const conn = await this.findByBusinessId(businessId);
    if (!conn || conn.phoneNumberId) return;
    const clash = await this.findByPhoneNumberId(phoneNumberId);
    if (clash) return;
    conn.phoneNumberId = phoneNumberId;
    await this.connections.save(conn);
  }

  // --- 360dialog inbound webhook auth ---------------------------------------
  // 360dialog does not sign forwarded payloads with Meta's app secret, so the
  // Meta HMAC check does not apply. Instead each business gets a unique webhook
  // URL carrying an HMAC-SHA256(businessId) token: only holders of the server
  // secret can mint a valid token, and the token names the tenant to route to.

  private webhookSecret(): string {
    const secret = this.cfg.get<string>('DIALOG360_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('DIALOG360_WEBHOOK_SECRET is not configured');
    }
    return secret;
  }

  webhookToken(businessId: string): string {
    return createHmac('sha256', this.webhookSecret())
      .update(businessId)
      .digest('hex');
  }

  verifyWebhookToken(businessId: string, provided: string): boolean {
    let expected: string;
    try {
      expected = this.webhookToken(businessId);
    } catch {
      return false;
    }
    if (!provided || provided.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /** Full inbound webhook URL to paste into the 360dialog channel settings. */
  webhookUrl(businessId: string): string {
    const base = (
      this.cfg.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const token = this.webhookToken(businessId);
    return `${base}/api/webhooks/whatsapp/360dialog/${businessId}?token=${token}`;
  }

  async delete(businessId: string): Promise<void> {
    const conn = await this.findByBusinessId(businessId);
    if (!conn) return;
    await this.connections.delete({ id: conn.id });
  }

  decryptAccessToken(c: WhatsappConnection): string {
    if (!c.accessTokenEncrypted) {
      throw new BadRequestException('Access token not configured');
    }
    return this.crypto.decrypt(c.accessTokenEncrypted);
  }

  async markActive(connectionId: string): Promise<void> {
    await this.connections.update(
      { id: connectionId },
      { status: 'active', lastError: null, connectedAt: new Date() },
    );
  }

  async markFailed(connectionId: string, error: string): Promise<void> {
    await this.connections.update(
      { id: connectionId },
      { status: 'failed', lastError: error.slice(0, 1000) },
    );
  }

  async requireActive(businessId: string): Promise<WhatsappConnection> {
    const conn = await this.findByBusinessId(businessId);
    if (!conn || conn.status !== 'active') {
      throw new NotFoundException(
        'WhatsApp is not connected for this business',
      );
    }
    return conn;
  }

  /**
   * Sends a plain-text WhatsApp message from the business's number to an
   * arbitrary recipient (e.g. the business owner's private number for an
   * appointment alert) — not tied to a customer conversation.
   *
   * NOTE: WhatsApp only allows free-form text inside the 24-hour customer
   * service window. A cold owner alert (owner hasn't messaged the business
   * number recently) needs an approved *template* message instead; this text
   * send will be rejected by WhatsApp in that case. Wire a template here once
   * one is approved. Best-effort: throws on failure for the caller to swallow.
   */
  async sendText(
    businessId: string,
    to: string,
    body: string,
  ): Promise<{ externalMessageId?: string }> {
    const conn = await this.findByBusinessId(businessId);
    if (!conn || conn.status !== 'active') {
      throw new NotFoundException(
        'WhatsApp is not connected for this business',
      );
    }
    const apiKey = this.decryptAccessToken(conn);
    const base =
      this.cfg.get<string>('DIALOG360_API_BASE') ??
      'https://waba-v2.360dialog.io';
    const url = `${base.replace(/\/$/, '')}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body, preview_url: false },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `WhatsApp owner-send failed (HTTP ${res.status}): ${errBody.slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as { messages?: Array<{ id?: string }> };
    return { externalMessageId: json.messages?.[0]?.id };
  }
}
