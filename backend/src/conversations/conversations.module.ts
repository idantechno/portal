import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BusinessesModule } from '../businesses/businesses.module';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CustomerContact } from './customer-contact.entity';
import { ConversationsService } from './conversations.service';
import { CustomerContactsService } from './customer-contacts.service';
import { ConversationsController } from './conversations.controller';
import { AGENT_RUNS_QUEUE } from '../agent-worker/agent-worker.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, CustomerContact]),
    BusinessesModule,
    BullModule.registerQueue({ name: AGENT_RUNS_QUEUE }),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, CustomerContactsService],
  exports: [ConversationsService, CustomerContactsService],
})
export class ConversationsModule {}
