import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { RunAgentDto } from './dto/run-agent.dto';

/**
 * Owner-facing, on-demand agent runs. Entitlement is re-checked in the service
 * (the agentKey is dynamic, so the static @RequireAgent decorator can't gate
 * it). Scoped to the business via BusinessScopeGuard.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/agents/:agentKey/run')
export class AgentRunController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post()
  run(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentKey') agentKey: string,
    @Body() dto: RunAgentDto,
  ) {
    return this.orchestrator.runAgent(businessId, agentKey, dto.instruction);
  }
}
