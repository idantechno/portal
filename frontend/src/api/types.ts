export type UserRole =
  | "global_admin"
  | "business_owner"
  | "business_agent";

export type BusinessRole = "owner" | "agent";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  ownerUserId: string;
  publicKey: string;
  publicKeyEnabled: boolean;
  systemPromptOverride: string | null;
  widgetAllowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
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
