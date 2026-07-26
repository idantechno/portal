import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { Subscription } from './subscription.entity';
import { Invoice } from './invoice.entity';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { BillingController } from './billing.controller';
import { RequireCapabilityGuard } from './guards/require-capability.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Invoice]),
    BusinessesModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, StripeService, RequireCapabilityGuard],
  exports: [BillingService, StripeService, RequireCapabilityGuard],
})
export class BillingModule {}
