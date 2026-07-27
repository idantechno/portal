import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { WebChannelAdapter } from './web-channel.adapter';

@Module({
  imports: [BusinessesModule, ConversationsModule, NotificationsModule],
  controllers: [WidgetController],
  providers: [WidgetService, WebChannelAdapter],
})
export class WidgetModule {}
