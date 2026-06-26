import { api } from "./client";
import type { Business, BusinessMember, BusinessRole } from "./types";

export const businessesApi = {
  list: () => api.get<Business[]>("/businesses").then((r) => r.data),
  get: (id: string) => api.get<Business>(`/businesses/${id}`).then((r) => r.data),
  create: (input: { name: string; slug?: string }) =>
    api.post<Business>("/businesses", input).then((r) => r.data),
  update: (
    id: string,
    input: {
      name?: string;
      slug?: string;
      systemPromptOverride?: string;
      publicKeyEnabled?: boolean;
      widgetAllowedOrigins?: string[];
    },
  ) => api.patch<Business>(`/businesses/${id}`, input).then((r) => r.data),

  // ---- Members ----
  listMembers: (businessId: string) =>
    api
      .get<BusinessMember[]>(`/businesses/${businessId}/members`)
      .then((r) => r.data),
  addMember: (
    businessId: string,
    input: {
      email: string;
      name: string;
      role: BusinessRole;
      temporaryPassword: string;
    },
  ) =>
    api
      .post<BusinessMember>(`/businesses/${businessId}/members`, input)
      .then((r) => r.data),
  updateMemberRole: (businessId: string, userId: string, role: BusinessRole) =>
    api
      .patch<BusinessMember>(
        `/businesses/${businessId}/members/${userId}`,
        { role },
      )
      .then((r) => r.data),
  removeMember: (businessId: string, userId: string) =>
    api
      .delete(`/businesses/${businessId}/members/${userId}`)
      .then((r) => r.data),
};
