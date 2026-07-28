import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CustomersModule } from '../customers/customers.module';
import { PlansModule } from '../plans/plans.module';
import { Campaign } from './campaign.entity';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignPrerequisitesService } from './campaign-prerequisites.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign]),
    AgentsModule,
    BusinessesModule,
    // Validate the customer + read the approved plan for the prerequisite gate.
    CustomersModule,
    PlansModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignPrerequisitesService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
