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
import { Throttle } from '@nestjs/throttler';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { CampaignsService } from './campaigns.service';
import { CampaignPrerequisitesService } from './campaign-prerequisites.service';
import { ProductionPlanService } from './production-plan.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ProductionAnswersDto } from './dto/production-answers.dto';
import { BuildScheduleDto, SaveScheduleDto } from './dto/schedule.dto';

// Campaigns are the marketing agent's tool — only businesses granted the
// "marketing" agent reach any of these routes.
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('marketing')
@Controller('businesses/:businessId')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly prerequisites: CampaignPrerequisitesService,
    private readonly production: ProductionPlanService,
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

  /** Stage B: save the owner's answers to the 3 creative questions. */
  @Patch('campaigns/:id/production-answers')
  saveAnswers(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProductionAnswersDto,
  ) {
    return this.campaigns.saveProductionAnswers(businessId, id, dto);
  }

  /** Stage B: generate the production plan from the plan + the 3 answers. */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('campaigns/:id/production-plan')
  async generateProduction(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const campaign = await this.campaigns.findByIdScoped(businessId, id);
    return this.production.generate(businessId, campaign);
  }

  /** Stage C: seed the schedule from the production items over a horizon. */
  @Post('campaigns/:id/schedule/build')
  buildSchedule(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BuildScheduleDto,
  ) {
    return this.campaigns.buildSchedule(businessId, id, dto.horizon);
  }

  /** Stage C: save the edited schedule (dates/channels/funding). */
  @Patch('campaigns/:id/schedule')
  saveSchedule(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveScheduleDto,
  ) {
    return this.campaigns.saveSchedule(businessId, id, dto);
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
