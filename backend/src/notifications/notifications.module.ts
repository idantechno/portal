import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { UsersModule } from '../users/users.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Notification } from './notification.entity';
import { PushSubscription } from './push-subscription.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, PushSubscription]),
    BusinessesModule,
    UsersModule,
    IntegrationsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
