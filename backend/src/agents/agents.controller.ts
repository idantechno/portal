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
 * Business-facing: the full agent catalog for this business's hub, each entry
 * flagged `entitled` (true = usable now, false = locked "premium"). Listing is
 * not authorization — the route guards still enforce real access. Any member
 * may read it.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.agents.listForBusiness(businessId);
  }
}
