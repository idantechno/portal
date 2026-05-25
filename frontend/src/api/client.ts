import axios, { AxiosError } from "axios";
import { useAuthStore } from "../store/auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  },
);

export type ApiError = AxiosError<{ message?: string | string[] }>;

export function apiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as ApiError;
  const m = ax?.response?.data?.message;
  if (Array.isArray(m)) return m.join(", ");
  if (typeof m === "string") return m;
  if (ax?.message) return ax.message;
  return fallback;
}
