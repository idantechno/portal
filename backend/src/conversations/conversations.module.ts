import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BusinessesModule } from '../businesses/businesses.module';
import { Business } from '../businesses/business.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CustomerContact } from './customer-contact.entity';
import { ConversationsService } from './conversations.service';
import { CustomerContactsService } from './customer-contacts.service';
import { ConversationsController } from './conversations.controller';
import { ContactsController } from './contacts.controller';
import { AGENT_RUNS_QUEUE } from '../agent-worker/agent-worker.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      CustomerContact,
      Business,
    ]),
    BusinessesModule,
    BullModule.registerQueue({ name: AGENT_RUNS_QUEUE }),
  ],
  controllers: [ConversationsController, ContactsController],
  providers: [ConversationsService, CustomerContactsService],
  exports: [ConversationsService, CustomerContactsService],
})
export class ConversationsModule {}
