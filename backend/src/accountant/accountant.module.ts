import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExpensesModule } from '../expenses/expenses.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AccountantService } from './accountant.service';
import { AccountantController } from './accountant.controller';
import { ACCOUNTANT_MONTHLY_QUEUE } from './accountant-monthly.constants';
import { AccountantMonthlyService } from './accountant-monthly.service';
import { AccountantMonthlyProcessor } from './accountant-monthly.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: ACCOUNTANT_MONTHLY_QUEUE }),
    ExpensesModule,
    IntegrationsModule,
    WhatsappModule,
    BusinessesModule,
  ],
  controllers: [AccountantController],
  providers: [
    AccountantService,
    AccountantMonthlyService,
    AccountantMonthlyProcessor,
  ],
  exports: [AccountantService],
})
export class AccountantModule {}
