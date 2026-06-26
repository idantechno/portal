export type UserRole = "super_admin" | "support" | "member";

export type BusinessRole = "owner" | "admin" | "agent" | "viewer";

export type AccountStatus = "active" | "suspended";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status?: AccountStatus;
  defaultBusinessId?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  status?: AccountStatus;
  ownerUserId: string;
  publicKey: string;
  publicKeyEnabled: boolean;
  systemPromptOverride: string | null;
  widgetAllowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
  /** The current caller's role in this business (null for platform staff). */
  myRole?: BusinessRole | null;
  /** True when the caller is here via platform-staff privilege, not membership. */
  viaPlatformStaff?: boolean;
}

export interface MemberUser {
  id: string;
  email: string;
  name: string;
  status: AccountStatus;
}

export interface BusinessMember {
  id: string;
  userId: string;
  businessId?: string;
  role: BusinessRole;
  createdAt: string;
  user: MemberUser | null;
}

export interface ContextFile {
  id: string;
  businessId: string;
  relativePath: string;
  mimeType: string;
  size: string;
  hiddenForBusiness: boolean;
  uploadedByUserId: string;
  createdAt: string;
}

export interface ContextFileTree {
  files: ContextFile[];
  folders: string[];
}

// ---- Admin ----

export interface AdminOverview {
  totalBusinesses: number;
  suspendedBusinesses: number;
  totalUsers: number;
  suspendedUsers: number;
}

export interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  status: AccountStatus;
  createdAt: string;
  memberCount: number;
  owner: MemberUser | null;
}

export interface AdminBusinessDetail {
  business: Business;
  members: BusinessMember[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  businessCount: number;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  businessId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
}
