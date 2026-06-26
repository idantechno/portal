import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Business } from '../business.entity';
import { BusinessMember } from '../business-member.entity';

export interface BusinessScopeContext {
  business: Business;
  /** Null when the caller is platform staff with no explicit membership. */
  membership: BusinessMember | null;
  /** True when access comes from platform-staff privilege, not membership. */
  viaPlatformStaff: boolean;
}

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BusinessScopeContext => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ businessScope?: BusinessScopeContext }>();
    if (!req.businessScope) {
      throw new Error(
        'CurrentBusiness used on a route without BusinessScopeGuard',
      );
    }
    return req.businessScope;
  },
);
