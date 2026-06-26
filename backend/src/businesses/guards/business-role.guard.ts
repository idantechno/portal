import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  BusinessRole,
  businessRoleAtLeast,
} from '../../common/enums/business-role.enum';
import { isPlatformStaff } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../auth/auth.types';
import { MIN_BUSINESS_ROLE_KEY } from '../decorators/business-roles.decorator';
import { BusinessScopeContext } from '../decorators/current-business.decorator';

/**
 * Enforces @MinBusinessRole(...). Must run AFTER BusinessScopeGuard, which puts
 * the caller's membership on req.businessScope. Platform staff bypass the rank
 * check (their cross-tenant access is gated + audited at BusinessScopeGuard).
 */
@Injectable()
export class BusinessRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const min = this.reflector.getAllAndOverride<BusinessRole | undefined>(
      MIN_BUSINESS_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!min) return true;

    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      businessScope?: BusinessScopeContext;
    }>();

    if (isPlatformStaff(req.user?.role)) return true;

    const role = req.businessScope?.membership?.role;
    if (businessRoleAtLeast(role, min)) return true;

    throw new ForbiddenException(`Requires business role: ${min} or higher`);
  }
}
