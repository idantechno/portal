import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { AgentChatService } from './agent-chat.service';
import { AppendChatDto } from './dto/append-chat.dto';

/**
 * Persistence for the owner↔agent workspace chats, kept 30 days. Separate path
 * from `/agents/...` so it never shadows the agent-run/entitlement routes. Read
 * and write stay open on every tier — it's a UI convenience log, not a gated
 * capability.
 */
@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/agent-chat')
export class AgentChatController {
  constructor(private readonly chat: AgentChatService) {}

  @Get(':agentKey')
  history(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentKey') agentKey: string,
  ) {
    return this.chat.history(businessId, agentKey);
  }

  @Post(':agentKey')
  async append(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentKey') agentKey: string,
    @Body() dto: AppendChatDto,
  ) {
    await this.chat.append(businessId, agentKey, dto.turns);
    return { ok: true };
  }

  @Delete(':agentKey')
  async clear(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentKey') agentKey: string,
  ) {
    await this.chat.clear(businessId, agentKey);
    return { ok: true };
  }
}
