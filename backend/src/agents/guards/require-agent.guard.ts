import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isPlatformStaff } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../auth/auth.types';
import { BusinessScopeContext } from '../../businesses/decorators/current-business.decorator';
import { AgentsService } from '../agents.service';
import { REQUIRE_AGENT_KEY } from '../decorators/require-agent.decorator';

/**
 * Enforces @RequireAgent(key): the scoped business must have that agent enabled.
 * Must run AFTER BusinessScopeGuard. Platform staff bypass (they can operate any
 * agent in any business).
 */
@Injectable()
export class RequireAgentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly agents: AgentsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_AGENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) return true;

    const req = context.switchToHttp().getRequest<{
      params: Record<string, string>;
      user?: AuthenticatedUser;
      businessScope?: BusinessScopeContext;
    }>();

    if (isPlatformStaff(req.user?.role)) return true;

    const businessId =
      req.params?.businessId ?? req.businessScope?.business?.id;
    if (!businessId) {
      throw new ForbiddenException('Missing business scope for agent check');
    }

    const ok = await this.agents.hasAccess(businessId, key);
    if (!ok) {
      throw new ForbiddenException(
        `This business does not have access to the "${key}" agent`,
      );
    }
    return true;
  }
}
