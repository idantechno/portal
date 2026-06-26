import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { AgentsService } from './agents.service';

/**
 * Business-facing: the agents this business is actually entitled to use. Drives
 * the dynamic "tools" list in the dashboard. Any member may read it.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.agents.entitledForBusiness(businessId);
  }
}
