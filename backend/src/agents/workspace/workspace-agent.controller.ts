import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../../businesses/guards/business-scope.guard';
import {
  CurrentBusiness,
  BusinessScopeContext,
} from '../../businesses/decorators/current-business.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.types';
import { AgentsService } from '../agents.service';
import { WorkspaceAgentService } from './workspace-agent.service';
import { WorkspaceChatDto } from './dto/workspace-chat.dto';
import { isWorkspaceAgentKey } from './workspace-agent.constants';

/**
 * Uniform chat endpoint for every "workspace" agent (marketing, analytics,
 * sales, crm, quote, accounting, orchestrator). One route, keyed by :agentKey.
 * Kept on its own /workspace/ path so the param route never shadows the bespoke
 * agents' literal /agents/<key>/chat routes. Entitlement is checked here
 * (dynamic key) rather than via the static @RequireAgent decorator.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/workspace')
export class WorkspaceAgentController {
  constructor(
    private readonly agent: WorkspaceAgentService,
    private readonly agents: AgentsService,
  ) {}

  @Post(':agentKey/chat')
  async chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentKey') agentKey: string,
    @Body() dto: WorkspaceChatDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBusiness() scope: BusinessScopeContext,
  ) {
    if (!isWorkspaceAgentKey(agentKey)) {
      throw new NotFoundException(`Unknown workspace agent: ${agentKey}`);
    }
    // Platform staff bypass; otherwise the business must be entitled to the key.
    if (!scope.viaPlatformStaff) {
      const ok = await this.agents.hasAccess(businessId, agentKey);
      if (!ok) {
        throw new ForbiddenException(
          `This business does not have access to the "${agentKey}" agent`,
        );
      }
    }
    return this.agent.chat(agentKey, {
      businessId,
      userId: user.id,
      history: dto.history,
    });
  }
}
