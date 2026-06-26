import { api } from "./client";
import type {
  AccountStatus,
  AdminBusiness,
  AdminBusinessDetail,
  AdminOverview,
  AdminUser,
  AgentAccessView,
  AuditPage,
  UserRole,
} from "./types";

export const adminApi = {
  overview: () =>
    api.get<AdminOverview>("/admin/overview").then((r) => r.data),

  listBusinesses: (q?: string) =>
    api
      .get<AdminBusiness[]>("/admin/businesses", { params: q ? { q } : {} })
      .then((r) => r.data),

  businessDetail: (id: string) =>
    api
      .get<AdminBusinessDetail>(`/admin/businesses/${id}`)
      .then((r) => r.data),

  /** Logs an audit "enter business" event and returns its detail. */
  accessBusiness: (id: string) =>
    api
      .post<AdminBusinessDetail>(`/admin/businesses/${id}/access`)
      .then((r) => r.data),

  setBusinessStatus: (id: string, status: AccountStatus) =>
    api
      .patch(`/admin/businesses/${id}/status`, { status })
      .then((r) => r.data),

  listUsers: (q?: string) =>
    api
      .get<AdminUser[]>("/admin/users", { params: q ? { q } : {} })
      .then((r) => r.data),

  setUserRole: (id: string, role: UserRole) =>
    api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data),

  setUserStatus: (id: string, status: AccountStatus) =>
    api.patch(`/admin/users/${id}/status`, { status }).then((r) => r.data),

  audit: (params: {
    businessId?: string;
    actorUserId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) =>
    api.get<AuditPage>("/admin/audit", { params }).then((r) => r.data),

  businessAgents: (id: string) =>
    api
      .get<AgentAccessView[]>(`/admin/businesses/${id}/agents`)
      .then((r) => r.data),

  setBusinessAgent: (id: string, agentKey: string, enabled: boolean) =>
    api
      .put(`/admin/businesses/${id}/agents/${agentKey}`, { enabled })
      .then((r) => r.data),
};
