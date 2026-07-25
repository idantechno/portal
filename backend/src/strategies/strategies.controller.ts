import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { StrategyGeneratorService } from './strategy-generator.service';
import { StrategiesService } from './strategies.service';
import { GenerateStrategyDto } from './dto/generate-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';

// Like the brief generator, the strategy stage is the marketing agent's tool —
// only businesses granted the "marketing" agent (an admin decision) reach any
// of these routes.
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('marketing')
@Controller('businesses/:businessId')
export class StrategiesController {
  constructor(
    private readonly strategies: StrategiesService,
    private readonly generator: StrategyGeneratorService,
  ) {}

  /** Generating fans out to a large model call — rate-limit it. Blocks with 400
   *  if the source brief is not yet approved. */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('briefs/:briefId/strategy')
  generate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('briefId', ParseUUIDPipe) briefId: string,
    @Body() dto: GenerateStrategyDto,
  ) {
    return this.generator.generate({
      businessId,
      briefId,
      skipDrafting: dto.skipDrafting ?? false,
    });
  }

  @Get('strategies')
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.strategies.list(businessId);
  }

  @Get('strategies/:id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.strategies.findByIdScoped(businessId, id);
  }

  @Patch('strategies/:id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStrategyDto,
  ) {
    return this.strategies.update(businessId, id, dto);
  }

  @Delete('strategies/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.strategies.remove(businessId, id);
    return { ok: true };
  }
}
