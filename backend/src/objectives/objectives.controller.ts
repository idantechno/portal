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
import { ObjectiveGeneratorService } from './objective-generator.service';
import { ObjectivesService } from './objectives.service';
import { GenerateObjectiveDto } from './dto/generate-objective.dto';
import { UpdateObjectiveDto } from './dto/update-objective.dto';

// The goals-&-objectives doc is the marketing agent's tool — only businesses
// granted the "marketing" agent reach these routes.
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('marketing')
@Controller('businesses/:businessId')
export class ObjectivesController {
  constructor(
    private readonly objectives: ObjectivesService,
    private readonly generator: ObjectiveGeneratorService,
  ) {}

  /** Generate from the customer's approved brief. Rate-limited (a model call). */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('customers/:customerId/objectives')
  generate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: GenerateObjectiveDto,
  ) {
    return this.generator.generate({
      businessId,
      customerId,
      skipDrafting: dto.skipDrafting ?? false,
    });
  }

  @Get('objectives')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.objectives.list(businessId, customerId);
  }

  @Get('objectives/:id')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.objectives.findByIdScoped(businessId, id);
  }

  @Patch('objectives/:id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObjectiveDto,
  ) {
    return this.objectives.update(businessId, id, dto);
  }

  @Delete('objectives/:id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.objectives.remove(businessId, id);
    return { ok: true };
  }
}
