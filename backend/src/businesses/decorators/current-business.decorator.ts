import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Business } from '../business.entity';
import { BusinessMember } from '../business-member.entity';

export interface BusinessScopeContext {
  business: Business;
  /** Null when the caller is a global_admin with no explicit membership. */
  membership: BusinessMember | null;
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
