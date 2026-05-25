import { Injectable } from '@nestjs/common';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { InboxGateway } from './inbox.gateway';

/**
 * The non-realtime parts of the system (HTTP controllers, BullMQ workers,
 * webhook receivers) call this to broadcast events into the inbox. Keeps the
 * gateway as the only place that touches Socket.IO.
 */
@Injectable()
export class InboxEventsService {
  constructor(private readonly gateway: InboxGateway) {}

  conversationCreated(conversation: Conversation): void {
    this.gateway.emitToBusiness(
      conversation.businessId,
      'conversation.created',
      conversation,
    );
  }

  conversationUpdated(conversation: Conversation): void {
    this.gateway.emitToBusiness(
      conversation.businessId,
      'conversation.updated',
      conversation,
    );
  }

  messageCreated(message: Message): void {
    this.gateway.emitToBusiness(message.businessId, 'message.created', message);
  }
}
