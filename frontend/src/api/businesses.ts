import { api } from "./client";
import type { Business } from "./types";

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
};
