import { UserRole } from '../common/enums/user-role.enum';

/**
 * Shape attached to req.user after the JwtAuthGuard succeeds.
 * Keep this minimal — anything richer should be fetched per-request from the DB.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
