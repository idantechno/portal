import type { BusinessRole, UserRole } from "../api/types";

/** Cross-tenant staff: can reach the admin area and enter any business. */
export function isPlatformStaff(role: UserRole | undefined | null): boolean {
  return role === "super_admin" || role === "support";
}

export function isSuperAdmin(role: UserRole | undefined | null): boolean {
  return role === "super_admin";
}

const BUSINESS_ROLE_RANK: Record<BusinessRole, number> = {
  viewer: 0,
  agent: 1,
  admin: 2,
  owner: 3,
};

export function businessRoleAtLeast(
  role: BusinessRole | null | undefined,
  min: BusinessRole,
): boolean {
  if (!role) return false;
  return BUSINESS_ROLE_RANK[role] >= BUSINESS_ROLE_RANK[min];
}

/**
 * Whether the caller may perform sensitive actions in a business (settings,
 * members, channels). Platform staff always may; otherwise needs admin+.
 */
export function canManageBusiness(
  businessRole: BusinessRole | null | undefined,
  platformRole: UserRole | undefined | null,
): boolean {
  return (
    isPlatformStaff(platformRole) || businessRoleAtLeast(businessRole, "admin")
  );
}

/** Whether the caller may send/act in conversations (everyone but viewers). */
export function canActInBusiness(
  businessRole: BusinessRole | null | undefined,
  platformRole: UserRole | undefined | null,
): boolean {
  return (
    isPlatformStaff(platformRole) || businessRoleAtLeast(businessRole, "agent")
  );
}
