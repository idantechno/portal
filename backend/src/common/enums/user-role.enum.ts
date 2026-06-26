/**
 * Platform-level role, stored on the User entity. This is the GLOBAL axis of
 * authorization — who you are across the whole product, independent of any
 * single business. Authority *inside* a business comes from BusinessRole on the
 * BusinessMember row, not from here.
 */
export enum UserRole {
  /** The operator. Full god-mode + manages other admins/support. */
  SuperAdmin = 'super_admin',
  /** Global support staff. Can view/enter any business (audited). */
  Support = 'support',
  /** Ordinary account. No platform powers — authority comes from memberships. */
  Member = 'member',
}

/** True only for the operator tier. */
export function isSuperAdmin(
  role: UserRole | string | null | undefined,
): boolean {
  return role === UserRole.SuperAdmin;
}

/**
 * True for any cross-tenant staff member (super admin or support). This is the
 * gate that lets someone see/enter businesses they aren't a member of.
 */
export function isPlatformStaff(
  role: UserRole | string | null | undefined,
): boolean {
  return role === UserRole.SuperAdmin || role === UserRole.Support;
}
