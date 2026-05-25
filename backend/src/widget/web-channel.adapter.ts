import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Channel } from '../common/enums/channel.enum';
import { ChannelAdapter } from '../channels/channel-adapter.interface';
import { ChannelRegistry } from '../channels/channel-registry.service';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';

/**
 * Web channel adapter. Outbound bot/agent messages are already persisted by
 * the time dispatch() is called, so the widget will discover them on its next
 * poll of `GET /api/widget/session/:sessionToken/messages`. No external API
 * call is needed.
 *
 * (When we upgrade the widget to Socket.IO this is where we'd push the event
 * to the conversation room.)
 */
@Injectable()
export class WebChannelAdapter implements ChannelAdapter, OnModuleInit {
  readonly channel = Channel.Web;
  private readonly log = new Logger(WebChannelAdapter.name);

  constructor(private readonly registry: ChannelRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- ChannelAdapter.send is async by contract; web channel is a no-op
  async send(
    conversation: Conversation,
    message: Message,
  ): Promise<{ externalMessageId?: string }> {
    this.log.debug(
      `Web channel dispatch (no-op) conv=${conversation.id} msg=${message.id}`,
    );
    return {};
  }
}
