import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AiUpdatesService } from './ai-updates.service';

/**
 * Business-facing AI-updates feed. Gated by the ai-updates agent entitlement,
 * exactly like the marketing agent's BriefsController — only businesses granted
 * the agent (an admin/plan decision) can read the digests. Content is global;
 * every entitled business sees the same 'business'-scoped digests.
 */
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('ai-updates')
@Controller('businesses/:businessId')
export class AiUpdatesController {
  constructor(private readonly updates: AiUpdatesService) {}

  // businessId + membership are validated by BusinessScopeGuard; the digest
  // content is global, so the handler doesn't need the id itself.
  @Get('ai-updates')
  list() {
    return this.updates.list('business');
  }
}

/**
 * Operator-only surface. The weekly Anthropic/Claude digest is platform-admin
 * material, and on-demand generation is a testing hook — both gated to the
 * operator by the globally-registered RolesGuard reading this @Roles metadata.
 */
@Roles(UserRole.SuperAdmin)
@Controller('ai-updates')
export class AiUpdatesAdminController {
  constructor(private readonly updates: AiUpdatesService) {}

  @Get('internal')
  listInternal() {
    return this.updates.list('internal');
  }

  /** Trigger generation on demand (operator testing). */
  @Post('generate')
  generate(@Body() body: { scope?: string }) {
    if (body?.scope === 'internal') {
      return this.updates.generateWeeklyInternalUpdate();
    }
    if (!body?.scope || body.scope === 'business') {
      return this.updates.generateDailyBusinessUpdate();
    }
    throw new BadRequestException(`Unknown scope: ${body.scope}`);
  }
}
