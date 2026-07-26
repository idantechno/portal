import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { BillingModule } from '../billing/billing.module';
import { Integration } from './integration.entity';
import { IntegrationsService } from './integrations.service';
import { GmailService } from './gmail.service';
import { CalendarService } from './calendar.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsGoogleController } from './integrations-google.controller';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration]),
    BusinessesModule,
    BillingModule,
  ],
  controllers: [
    IntegrationsController,
    IntegrationsGoogleController,
    CalendarController,
  ],
  providers: [IntegrationsService, GmailService, CalendarService],
  exports: [IntegrationsService, GmailService, CalendarService],
})
export class IntegrationsModule {}
