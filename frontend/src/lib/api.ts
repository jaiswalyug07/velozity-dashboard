import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiEnvelope, ApiErrorBody } from "../types";

const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/** Exchange the HttpOnly refresh cookie for a fresh access token. */
export async function tryRefresh(): Promise<string | null> {
  const { data } = await axios.post<ApiEnvelope<{ accessToken: string }>>(
    `${API_URL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  );
  const token = data.data.accessToken;
  accessToken = token;
  return token;
}

// Single-flight refresh: concurrent 401s wait on the same promise.
function refreshToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = tryRefresh()
      .then((token) => {
        accessToken = token;
        return token;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

let listener: (() => void) | null = null;
export function onAuthExpired(cb: () => void) {
  listener = cb;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    // Skip refresh for auth endpoints themselves (login/refresh/logout).
    const isAuthCall = url.startsWith("/api/auth");
    if (status === 401 && !original?._retried && !isAuthCall) {
      original!._retried = true;
      const token = await refreshToken();
      if (token && original) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      // Refresh failed: the session is gone.
      listener?.();
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}