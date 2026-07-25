import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel } from '../common/enums/channel.enum';
import { ChannelAdapter } from '../channels/channel-adapter.interface';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { WhatsappConnectionsService } from './whatsapp-connections.service';

// 360dialog is our WhatsApp BSP. Its messaging API is a 1:1 proxy of Meta's
// Cloud API — identical request/response bodies — so only the base URL and the
// auth header (D360-API-KEY instead of a Bearer token) differ from Meta direct.
const DEFAULT_DIALOG360_BASE = 'https://waba-v2.360dialog.io';

@Injectable()
export class WhatsappChannelAdapter implements ChannelAdapter, OnModuleInit {
  readonly channel = Channel.WhatsApp;
  private readonly log = new Logger(WhatsappChannelAdapter.name);

  constructor(
    private readonly conns: WhatsappConnectionsService,
    private readonly registry: ChannelRegistry,
    private readonly cfg: ConfigService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async send(
    conversation: Conversation,
    message: Message,
  ): Promise<{ externalMessageId?: string }> {
    const conn = await this.conns.findByBusinessId(conversation.businessId);
    if (!conn) {
      throw new Error(
        `No WhatsApp connection for business ${conversation.businessId}`,
      );
    }
    const apiKey = this.conns.decryptAccessToken(conn);
    const recipient = conversation.externalThreadId;

    // 360dialog routes by the API key (one key per hosted number), so — unlike
    // Meta direct — the phone number id is not part of the URL.
    const base =
      this.cfg.get<string>('DIALOG360_API_BASE') ?? DEFAULT_DIALOG360_BASE;
    const url = `${base.replace(/\/$/, '')}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: { body: message.content, preview_url: false },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      const msg = `WhatsApp send failed (HTTP ${res.status}): ${errBody.slice(0, 300)}`;
      this.log.error(msg);
      await this.conns.markFailed(conn.id, msg);
      throw new Error(msg);
    }

    const json = (await res.json()) as { messages?: Array<{ id?: string }> };
    const externalMessageId = json.messages?.[0]?.id;
    return { externalMessageId };
  }
}
