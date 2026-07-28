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
import { PlanGeneratorService } from './plan-generator.service';
import { PlansService } from './plans.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

// Like the brief and strategy stages, the plan is the marketing agent's tool —
// only businesses granted the "marketing" agent reach any of these routes.
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('marketing')
@Controller('businesses/:businessId')
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly generator: PlanGeneratorService,
  ) {}

  /** Generating fans out to a large model call — rate-limit it. Blocks with 400
   *  if the source strategy is not yet approved. */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('strategies/:strategyId/plan')
  generate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body() dto: GeneratePlanDto,
  ) {
    return this.generator.generate({
      businessId,
      strategyId,
      skipDrafting: dto.skipDrafting ?? false,
    });
  }

  @Get('plans')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.plans.list(businessId, customerId);
  }

  @Get('plans/:id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plans.findByIdScoped(businessId, id);
  }

  @Patch('plans/:id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(businessId, id, dto);
  }

  @Delete('plans/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.plans.remove(businessId, id);
    return { ok: true };
  }
}
