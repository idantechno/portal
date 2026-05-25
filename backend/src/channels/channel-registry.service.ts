import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '../common/enums/channel.enum';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { ChannelAdapter } from './channel-adapter.interface';

/**
 * Holds the per-Channel adapter instances. Adapters register themselves on
 * module init via `register()`. The agent worker / inbox uses `dispatch()`
 * to deliver an outbound message over the right channel.
 */
@Injectable()
export class ChannelRegistry {
  private readonly log = new Logger(ChannelRegistry.name);
  private readonly adapters = new Map<Channel, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    if (this.adapters.has(adapter.channel)) {
      this.log.warn(`Replacing existing adapter for channel=${adapter.channel}`);
    }
    this.adapters.set(adapter.channel, adapter);
    this.log.log(`Registered channel adapter: ${adapter.channel}`);
  }

  get(channel: Channel): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  async dispatch(
    conversation: Conversation,
    message: Message,
  ): Promise<{ externalMessageId?: string }> {
    const adapter = this.adapters.get(conversation.channel);
    if (!adapter) {
      throw new Error(`No channel adapter registered for ${conversation.channel}`);
    }
    return adapter.send(conversation, message);
  }
}
