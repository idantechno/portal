/**
 * Per-business role, stored on the BusinessMember row. This is the LOCAL axis of
 * authorization — what you may do inside one specific business. Ordered by
 * power; use businessRoleAtLeast() for "this action needs at least X".
 */
export enum BusinessRole {
  /** Founding/billing owner. Everything, including deleting the business. */
  Owner = 'owner',
  /** Manager. Settings, members, channels — sensitive actions minus ownership. */
  Admin = 'admin',
  /** The everyday user: inbox, leads, documents. No settings/members/channels. */
  Agent = 'agent',
  /** Read-only. */
  Viewer = 'viewer',
}

const RANK: Record<BusinessRole, number> = {
  [BusinessRole.Viewer]: 0,
  [BusinessRole.Agent]: 1,
  [BusinessRole.Admin]: 2,
  [BusinessRole.Owner]: 3,
};

export function businessRoleRank(
  role: BusinessRole | string | null | undefined,
): number {
  if (role && role in RANK) return RANK[role as BusinessRole];
  return -1;
}

/** True when `role` is at least as powerful as `min`. */
export function businessRoleAtLeast(
  role: BusinessRole | string | null | undefined,
  min: BusinessRole,
): boolean {
  return businessRoleRank(role) >= RANK[min];
}
