import { SetMetadata } from '@nestjs/common';
import { BusinessRole } from '../../common/enums/business-role.enum';

export const MIN_BUSINESS_ROLE_KEY = 'min_business_role';

/**
 * Declares the minimum business role required for a route. Enforced by
 * BusinessRoleGuard, which must run after BusinessScopeGuard. Platform staff
 * (super admin / support) always pass — they manage businesses remotely.
 *
 * e.g. @MinBusinessRole(BusinessRole.Admin) for settings/members/channels.
 */
export const MinBusinessRole = (role: BusinessRole) =>
  SetMetadata(MIN_BUSINESS_ROLE_KEY, role);
