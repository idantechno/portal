import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from '../audit/audit.service';
import { AgentsService } from './agents.service';
import { isAgentKey } from './agent-catalog';
import { SetAgentAccessDto } from './dto/set-agent-access.dto';

/**
 * Admin-facing agent entitlements. Platform staff may read the per-business
 * catalog state; only super admins may grant/revoke. Enforced by the globally
 * registered RolesGuard reading this metadata.
 */
@Roles(UserRole.SuperAdmin, UserRole.Support)
@Controller('admin/businesses/:businessId/agents')
export class AgentsAdminController {
  constructor(
    private readonly agents: AgentsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.agents.accessForBusiness(businessId);
  }

  @Roles(UserRole.SuperAdmin)
  @Put(':agentKey')
  async setAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentKey') agentKey: string,
    @Body() dto: SetAgentAccessDto,
    @Ip() ip: string,
  ) {
    if (!isAgentKey(agentKey)) {
      throw new BadRequestException(`Unknown agent: ${agentKey}`);
    }
    const row = await this.agents.setAccess(
      businessId,
      agentKey,
      dto.enabled,
      actor.id,
    );
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.enabled ? 'agent.granted' : 'agent.revoked',
      businessId,
      targetType: 'agent',
      targetId: agentKey,
      metadata: { enabled: dto.enabled },
      ip,
    });
    return row;
  }
}
