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
import { PlanCapability } from '../plan-capabilities';
import { BillingService } from '../billing.service';
import { REQUIRE_CAPABILITY_KEY } from '../decorators/require-capability.decorator';

/**
 * Enforces @RequireCapability(cap): the scoped business's plan must include that
 * capability. Must run AFTER BusinessScopeGuard. Platform staff bypass (they can
 * operate any business regardless of its plan).
 */
@Injectable()
export class RequireCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capability = this.reflector.getAllAndOverride<
      PlanCapability | undefined
    >(REQUIRE_CAPABILITY_KEY, [context.getHandler(), context.getClass()]);
    if (!capability) return true;

    const req = context.switchToHttp().getRequest<{
      params: Record<string, string>;
      user?: AuthenticatedUser;
      businessScope?: BusinessScopeContext;
    }>();

    if (isPlatformStaff(req.user?.role)) return true;

    const businessId =
      req.params?.businessId ?? req.businessScope?.business?.id;
    if (!businessId) {
      throw new ForbiddenException('Missing business scope for plan check');
    }

    const ok = await this.billing.hasCapability(businessId, capability);
    if (!ok) {
      throw new ForbiddenException(
        `This business's plan does not include the "${capability}" capability`,
      );
    }
    return true;
  }
}
