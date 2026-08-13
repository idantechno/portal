import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Appointment } from './appointment.entity';
import { WaitlistEntry } from './waitlist-entry.entity';
import { AppointmentsService } from './appointments.service';
import { WaitlistService } from './waitlist.service';
import { AppointmentsController } from './appointments.controller';
import { WaitlistController } from './waitlist.controller';
import { CALENDAR_RECONCILE_QUEUE } from './calendar-reconcile.constants';
import { CalendarReconcileService } from './calendar-reconcile.service';
import { CalendarReconcileProcessor } from './calendar-reconcile.processor';
import { BusinessesModule } from '../businesses/businesses.module';
import { CustomersModule } from '../customers/customers.module';
import { BillingModule } from '../billing/billing.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { TasksModule } from '../tasks/tasks.module';
import { TemplatesModule } from '../templates/templates.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, WaitlistEntry]),
    BullModule.registerQueue({ name: CALENDAR_RECONCILE_QUEUE }),
    BusinessesModule,
    CustomersModule,
    BillingModule,
    IntegrationsModule,
    NotificationsModule,
    UsersModule,
    WhatsappModule,
    ConversationsModule,
    TasksModule,
    TemplatesModule,
    ScheduleModule,
    CrmModule,
  ],
  controllers: [AppointmentsController, WaitlistController],
  providers: [
    AppointmentsService,
    WaitlistService,
    CalendarReconcileService,
    CalendarReconcileProcessor,
  ],
  exports: [AppointmentsService, WaitlistService],
})
export class AppointmentsModule {}
