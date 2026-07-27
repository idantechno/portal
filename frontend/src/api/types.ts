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

export interface BusinessBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  slogan?: string;
}

export interface BusinessOnboarding {
  completed?: boolean;
  industry?: string;
  audience?: string;
  offerings?: string;
  tone?: string;
  goals?: string;
  differentiators?: string;
  notes?: string;
  city?: string;
}

export interface WhatsappAgentWindow {
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** 'HH:mm' */
  start: string;
  /** 'HH:mm' — if end <= start the window wraps past midnight. */
  end: string;
}

export type WhatsappAgentMode = "always" | "off" | "scheduled";

export interface WhatsappAgentConfig {
  mode: WhatsappAgentMode;
  timezone?: string;
  windows?: WhatsappAgentWindow[];
  /** Hand a manual thread back to the agent after N idle hours. 0 = off. */
  autoReturnHours?: number;
  /** Calendar-aware "busy": tell customers when the owner is in an event now. */
  busyMode?: boolean;
  /** Custom phrasing instead of the calendar event's title. */
  busyLabel?: string | null;
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
  branding?: BusinessBranding | null;
  onboarding?: BusinessOnboarding | null;
  whatsappAgent?: WhatsappAgentConfig | null;
  /** Owner's private phone (E.164) for WhatsApp alerts like new bookings. */
  ownerPhone?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when the tenant is scheduled for deletion (soft-deleted). */
  deletedAt?: string | null;
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
  /** Set when the tenant is scheduled for deletion (soft-deleted). */
  deletedAt: string | null;
  /** When it will be irreversibly purged (deletedAt + 30d), null otherwise. */
  purgeAt: string | null;
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

// ---- Agents ----

export type AgentPillar =
  | "conversations"
  | "orchestration"
  | "sales"
  | "content"
  | "documents"
  | "finance"
  | "growth";

export interface AgentDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  status?: "live" | "soon";
  pillar?: AgentPillar;
}

export interface AgentAccessView extends AgentDefinition {
  enabled: boolean;
}

export interface CreateClientResult {
  business: Business;
  owner: { id: string; email: string; name: string };
  temporaryPassword: string | null;
  ownerExisted: boolean;
}
