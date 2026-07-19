import type { AuthResponse } from "@/lib/types";


const browserApiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
export const API_BASE = typeof window === "undefined"
  ? process.env.API_SERVER_BASE || browserApiBase
  : browserApiBase;

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse | null> | null = null;
const publicResponseCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();


export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}


export function getAccessToken(): string | null {
  return accessToken;
}


export function setAccessToken(token: string | null): void {
  accessToken = token;
}


async function responseError(response: Response): Promise<ApiError> {
  const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
  const detail = typeof payload?.detail === "string" ? payload.detail : response.statusText;
  return new ApiError(detail || "Yêu cầu thất bại", response.status, response.headers.get("X-Request-ID"));
}


export async function refreshAccessToken(): Promise<AuthResponse | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      setAccessToken(null);
      return null;
    }
    const session = await response.json() as AuthResponse;
    setAccessToken(session.access_token);
    return session;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}


export async function apiFetch(
  input: string,
  init: RequestInit = {},
  retryAuth = true
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(input, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retryAuth && !input.includes("/api/auth/")) {
    if (await refreshAccessToken()) return apiFetch(input, init, false);
  }
  return response;
}


export async function requestJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}


export function getJson<T>(input: string): Promise<T> {
  return requestJson<T>(input, { cache: "no-store" });
}


/**
 * Read public, non-user-specific data without making every route transition
 * wait for the upstream service again. Next.js keeps a short server cache;
 * the browser cache also deduplicates requests made by sibling components.
 */
export function getPublicJson<T>(input: string, revalidateSeconds: number): Promise<T> {
  if (typeof window === "undefined") {
    return requestJson<T>(input, { next: { revalidate: revalidateSeconds } });
  }

  const now = Date.now();
  const cached = publicResponseCache.get(input);
  if (cached && cached.expiresAt > now) return cached.value as Promise<T>;

  const value = requestJson<T>(input, { cache: "default" }).catch((error) => {
    publicResponseCache.delete(input);
    throw error;
  });
  publicResponseCache.set(input, {
    expiresAt: now + revalidateSeconds * 1000,
    value,
  });
  return value;
}


export function sendJson<T>(
  input: string,
  body: unknown,
  method: "POST" | "PATCH" | "PUT" = "POST"
): Promise<T> {
  return requestJson<T>(input, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}


export async function deleteRequest(input: string): Promise<void> {
  const response = await apiFetch(input, { method: "DELETE" });
  if (!response.ok) throw await responseError(response);
}
