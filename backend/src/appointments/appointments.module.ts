import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { WaitlistEntry } from './waitlist-entry.entity';
import { AppointmentsService } from './appointments.service';
import { WaitlistService } from './waitlist.service';
import { AppointmentsController } from './appointments.controller';
import { WaitlistController } from './waitlist.controller';
import { BusinessesModule } from '../businesses/businesses.module';
import { BillingModule } from '../billing/billing.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, WaitlistEntry]),
    BusinessesModule,
    BillingModule,
    IntegrationsModule,
    NotificationsModule,
    UsersModule,
    WhatsappModule,
    ConversationsModule,
  ],
  controllers: [AppointmentsController, WaitlistController],
  providers: [AppointmentsService, WaitlistService],
  exports: [AppointmentsService, WaitlistService],
})
export class AppointmentsModule {}
