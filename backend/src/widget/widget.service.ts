import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { BusinessesService } from '../businesses/businesses.service';
import { Business } from '../businesses/business.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomerContactsService } from '../conversations/customer-contacts.service';
import { Channel } from '../common/enums/channel.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';

const SESSION_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const generateSessionToken = customAlphabet(SESSION_ALPHABET, 32);

export interface ResolvedSession {
  business: Business;
  conversation: Conversation;
}

/**
 * The web widget is unauthenticated — security model:
 * - `publicKey` identifies the business and gates session creation
 * - `sessionToken` (random 32-char) identifies one anonymous customer for
 *   subsequent calls; it doubles as the CustomerContact.externalId so the
 *   conversation is uniquely keyed in our channel-agnostic schema
 *
 * Anyone with the sessionToken can read/write the conversation it points at —
 * that's the same as any other widget chat across the industry.
 */
@Injectable()
export class WidgetService {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly contacts: CustomerContactsService,
    private readonly conversations: ConversationsService,
  ) {}

  async createSession(publicKey: string): Promise<{
    sessionToken: string;
    conversationId: string;
  }> {
    const business = await this.businesses.findByPublicKey(publicKey);
    if (!business) {
      throw new NotFoundException('Unknown widget public key');
    }
    const sessionToken = generateSessionToken();
    const contact = await this.contacts.upsert({
      businessId: business.id,
      channel: Channel.Web,
      externalId: sessionToken,
      displayName: null,
    });
    const conversation = await this.conversations.findOrCreate({
      businessId: business.id,
      channel: Channel.Web,
      externalThreadId: sessionToken,
      customerContactId: contact.id,
    });
    return { sessionToken, conversationId: conversation.id };
  }

  async resolve(sessionToken: string): Promise<ResolvedSession> {
    const contact = await this.contacts.findByExternalId(
      Channel.Web,
      sessionToken,
    );
    if (!contact) throw new UnauthorizedException('Unknown session');
    const conversation = await this.conversations.findOrCreate({
      businessId: contact.businessId,
      channel: Channel.Web,
      externalThreadId: sessionToken,
      customerContactId: contact.id,
    });
    const business = await this.businesses.findById(contact.businessId);
    if (!business) throw new NotFoundException('Business not found');
    return { business, conversation };
  }

  async sendCustomerMessage(
    sessionToken: string,
    content: string,
  ): Promise<Message> {
    const { conversation } = await this.resolve(sessionToken);
    if (conversation.status === ConversationStatus.Closed) {
      throw new UnauthorizedException('Conversation is closed');
    }
    return this.conversations.appendMessage({
      businessId: conversation.businessId,
      conversationId: conversation.id,
      role: MessageRole.Customer,
      content,
    });
  }

  async listMessages(
    sessionToken: string,
    options: { since?: Date } = {},
  ): Promise<{ messages: Message[]; conversationStatus: ConversationStatus }> {
    const { conversation } = await this.resolve(sessionToken);
    const all = await this.conversations.listMessages(
      conversation.businessId,
      conversation.id,
      { limit: 200 },
    );
    const messages = options.since
      ? all.filter(
          (m) =>
            // Only return messages strictly after `since` and only the
            // customer-visible roles. Internal "tool" + "system" stay hidden.
            new Date(m.createdAt) > options.since! &&
            m.role !== MessageRole.Tool &&
            m.role !== MessageRole.System,
        )
      : all.filter(
          (m) =>
            m.role !== MessageRole.Tool && m.role !== MessageRole.System,
        );
    return { messages, conversationStatus: conversation.status };
  }
}
