import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { BusinessRole } from '../../common/enums/business-role.enum';
import { AuthenticatedUser } from '../../auth/auth.types';
import { BusinessScopeContext } from '../decorators/current-business.decorator';

/**
 * Allows only business owners (or global_admin). Must run after BusinessScopeGuard.
 */
@Injectable()
export class BusinessOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      businessScope?: BusinessScopeContext;
    }>();

    if (req.user?.role === UserRole.GlobalAdmin) return true;
    if (req.businessScope?.membership?.role === BusinessRole.Owner) return true;

    throw new ForbiddenException('Business owner role required');
  }
}
