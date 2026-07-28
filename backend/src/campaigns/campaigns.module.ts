import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CustomersModule } from '../customers/customers.module';
import { PlansModule } from '../plans/plans.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ObjectivesModule } from '../objectives/objectives.module';
import { Campaign } from './campaign.entity';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignPrerequisitesService } from './campaign-prerequisites.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign]),
    AgentsModule,
    BusinessesModule,
    // Validate the customer + read approved plan/quote/objectives for the gate.
    CustomersModule,
    PlansModule,
    QuotesModule,
    ObjectivesModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignPrerequisitesService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
