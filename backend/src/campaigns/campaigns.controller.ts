import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { CampaignsService } from './campaigns.service';
import { CampaignPrerequisitesService } from './campaign-prerequisites.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

// Campaigns are the marketing agent's tool — only businesses granted the
// "marketing" agent reach any of these routes.
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('marketing')
@Controller('businesses/:businessId')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly prerequisites: CampaignPrerequisitesService,
  ) {}

  /** The prerequisite checklist for a customer — drives the create gate in the UI. */
  @Get('customers/:customerId/campaign-prerequisites')
  prereqs(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.prerequisites.report(businessId, customerId);
  }

  @Post('customers/:customerId/campaigns')
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaigns.create({ businessId, customerId, name: dto.name });
  }

  @Get('campaigns')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.campaigns.list(businessId, customerId);
  }

  @Get('campaigns/:id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaigns.findByIdScoped(businessId, id);
  }

  @Patch('campaigns/:id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(businessId, id, dto);
  }

  @Delete('campaigns/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.campaigns.remove(businessId, id);
    return { ok: true };
  }
}
