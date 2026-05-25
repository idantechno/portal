import { Channel } from '../common/enums/channel.enum';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';

/**
 * Each channel (web, whatsapp, instagram) implements this and registers itself
 * with the ChannelRegistry. The agent worker + inbox call `send` to deliver
 * an outbound message to the customer over the channel's native surface.
 */
export interface ChannelAdapter {
  readonly channel: Channel;

  /**
   * Deliver an already-persisted message to the customer over this channel.
   * Should return the channel-native message id when available (e.g. WhatsApp wamid).
   */
  send(conversation: Conversation, message: Message): Promise<{ externalMessageId?: string }>;
}
