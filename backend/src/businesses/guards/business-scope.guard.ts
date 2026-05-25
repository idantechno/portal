import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../businesses.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../auth/auth.types';
import { BusinessScopeContext } from '../decorators/current-business.decorator';

/**
 * Resolves :businessId from the route, verifies the current user is a member
 * (or a global_admin), and attaches { business, membership } as req.businessScope.
 *
 * Use on any controller scoped under /businesses/:businessId/...
 */
@Injectable()
export class BusinessScopeGuard implements CanActivate {
  constructor(private readonly businesses: BusinessesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      params: Record<string, string>;
      user?: AuthenticatedUser;
      businessScope?: BusinessScopeContext;
    }>();

    const businessId = req.params.businessId;
    if (!businessId) {
      throw new BadRequestException('Missing :businessId in route');
    }
    if (!req.user) {
      throw new ForbiddenException('No authenticated user');
    }

    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundException('Business not found');

    const membership = await this.businesses.membership(
      business.id,
      req.user.id,
    );
    if (!membership && req.user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException('Not a member of this business');
    }

    req.businessScope = { business, membership };
    return true;
  }
}
