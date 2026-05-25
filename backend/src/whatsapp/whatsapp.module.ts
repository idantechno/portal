import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsappConnection } from './whatsapp-connection.entity';
import { WhatsappWebhookEvent } from './whatsapp-webhook-event.entity';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappWebhookEventsService } from './whatsapp-webhook-events.service';
import { WhatsappConnectionsController } from './whatsapp-connections.controller';
import { WhatsappOnboardingController } from './whatsapp-onboarding.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappChannelAdapter } from './whatsapp-channel.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappConnection, WhatsappWebhookEvent]),
    BusinessesModule,
    ConversationsModule,
  ],
  controllers: [
    WhatsappConnectionsController,
    WhatsappOnboardingController,
    WhatsappWebhookController,
  ],
  providers: [
    WhatsappConnectionsService,
    WhatsappWebhookEventsService,
    WhatsappChannelAdapter,
  ],
  exports: [WhatsappConnectionsService],
})
export class WhatsappModule {}
