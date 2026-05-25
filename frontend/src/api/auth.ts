import { api } from "./client";
import type { AuthResponse, AuthUser } from "./types";

export const authApi = {
  signup: (input: { email: string; password: string; name: string }) =>
    api.post<AuthResponse>("/auth/signup", input).then((r) => r.data),
  login: (input: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", input).then((r) => r.data),
  me: () => api.get<AuthUser>("/auth/me").then((r) => r.data),
};
