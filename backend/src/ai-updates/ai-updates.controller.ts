import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import {
  CurrentBusiness,
  BusinessScopeContext,
} from '../businesses/decorators/current-business.decorator';
import { RequireAgentGuard } from '../agents/guards/require-agent.guard';
import { RequireAgent } from '../agents/decorators/require-agent.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, isPlatformStaff } from '../common/enums/user-role.enum';
import { AiUpdatesService } from './ai-updates.service';

/**
 * Business-facing AI-updates feed — OPERATOR-ONLY. The agent is marked
 * `operatorOnly` in the catalog: the frontend hides its hub card / route from
 * clients, and this endpoint enforces the same on the server so a client can't
 * read the digests by calling the API directly. Only platform staff (or someone
 * who entered the business via staff) may read. Content is global; the operator
 * sees the same 'business'-scoped digests from any business.
 */
@UseGuards(BusinessScopeGuard, RequireAgentGuard)
@RequireAgent('ai-updates')
@Controller('businesses/:businessId')
export class AiUpdatesController {
  constructor(private readonly updates: AiUpdatesService) {}

  // businessId + membership are validated by BusinessScopeGuard; the digest
  // content is global, so the handler doesn't need the id itself.
  @Get('ai-updates')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBusiness() scope: BusinessScopeContext,
  ) {
    // Operator-only: platform staff, or a staff member viewing this business.
    if (!isPlatformStaff(user.role) && !scope.viaPlatformStaff) {
      throw new ForbiddenException('AI_UPDATES_OPERATOR_ONLY');
    }
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
  async generate(@Body() body: { scope?: string }) {
    const scope = body?.scope ?? 'business';
    if (scope !== 'business' && scope !== 'internal') {
      throw new BadRequestException(`Unknown scope: ${scope}`);
    }
    const update =
      scope === 'internal'
        ? await this.updates.generateWeeklyInternalUpdate()
        : await this.updates.generateDailyBusinessUpdate();
    // null = the web-search-grounded generation produced nothing. Rather than
    // silently "succeed" with no new card, tell the operator plainly — the most
    // common cause is Claude's server-side web-search allotment being exhausted.
    if (!update) {
      throw new ServiceUnavailableException(
        'לא הצלחנו להביא עדכוני AI כרגע. ייתכן שמכסת חיפוש האינטרנט של Claude מוצתה — בדוק את מגבלות/מכסת ה-API בחשבון Anthropic ונסה שוב מאוחר יותר.',
      );
    }
    return update;
  }
}
