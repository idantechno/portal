import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { Subscription } from './subscription.entity';
import { Invoice } from './invoice.entity';
import { User } from '../users/user.entity';
import { Business } from '../businesses/business.entity';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { BillingController } from './billing.controller';
import { MorningWebhookController } from './morning-webhook.controller';
import { MorningWebhookService } from './morning-webhook.service';
import { RequireCapabilityGuard } from './guards/require-capability.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Invoice, User, Business]),
    BusinessesModule,
  ],
  controllers: [BillingController, MorningWebhookController],
  providers: [
    BillingService,
    StripeService,
    MorningWebhookService,
    RequireCapabilityGuard,
  ],
  exports: [BillingService, StripeService, RequireCapabilityGuard],
})
export class BillingModule {}
