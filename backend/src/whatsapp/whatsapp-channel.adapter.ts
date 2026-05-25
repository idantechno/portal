import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Channel } from '../common/enums/channel.enum';
import { ChannelAdapter } from '../channels/channel-adapter.interface';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { WhatsappConnectionsService } from './whatsapp-connections.service';

const GRAPH_VERSION = 'v21.0';

@Injectable()
export class WhatsappChannelAdapter implements ChannelAdapter, OnModuleInit {
  readonly channel = Channel.WhatsApp;
  private readonly log = new Logger(WhatsappChannelAdapter.name);

  constructor(
    private readonly conns: WhatsappConnectionsService,
    private readonly registry: ChannelRegistry,
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
    const token = this.conns.decryptAccessToken(conn);
    const recipient = conversation.externalThreadId;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${conn.phoneNumberId}/messages`;
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
        Authorization: `Bearer ${token}`,
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
