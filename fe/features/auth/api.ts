import {
  API_BASE,
  deleteRequest,
  getJson,
  refreshAccessToken,
  sendJson,
  setAccessToken,
} from "@/lib/api/client";
import type { AdminUser, AuthResponse, AuthUser, Official, Resident } from "@/lib/types";


async function authRequest(
  body: Record<string, unknown>,
  action: "login" | "register"
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || response.statusText);
  }
  const result = await response.json() as AuthResponse;
  setAccessToken(result.access_token);
  return result;
}


export function registerResident(phone: string, password: string, displayName: string, communeId: string) {
  return authRequest({ phone, password, display_name: displayName, commune_id: communeId, role: "resident" }, "register")
    .then((result) => result.user as Resident);
}


export function loginResident(phone: string, password: string) {
  return authRequest({ phone, password, role: "resident" }, "login")
    .then((result) => result.user as Resident);
}


export function registerOfficial(phone: string, password: string, displayName: string, communeId: string) {
  return authRequest({ phone, password, display_name: displayName, commune_id: communeId, role: "official" }, "register")
    .then((result) => result.user as Official);
}


export function loginOfficial(phone: string, password: string) {
  return authRequest({ phone, password, role: "official" }, "login")
    .then((result) => result.user as Official);
}


export function loginAdmin(phone: string, password: string) {
  return authRequest({ phone, password, role: "admin" }, "login")
    .then((result) => result.user as AdminUser);
}


export async function restoreSession(): Promise<AuthUser | null> {
  return (await refreshAccessToken())?.user ?? null;
}


export function fetchCurrentUser(): Promise<AuthUser> {
  return getJson(`${API_BASE}/api/auth/me`);
}


export async function logoutSession(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    setAccessToken(null);
  }
}


export function fetchResident(residentId: string): Promise<Resident> {
  return fetchCurrentUser().then((user) => {
    if (user.role !== "resident" || user.id !== residentId) throw new Error("Resident mismatch");
    return user;
  });
}


export function fetchOfficial(officialId: string): Promise<Official> {
  return fetchCurrentUser().then((user) => {
    if (user.role !== "official" || user.id !== officialId) throw new Error("Official mismatch");
    return user;
  });
}


export function updateResidentProfile(_: string, displayName: string, communeId: string): Promise<Resident> {
  return sendJson(`${API_BASE}/api/auth/me`, { display_name: displayName, commune_id: communeId }, "PATCH");
}


export interface AdminUserInput {
  phone: string;
  password: string;
  display_name: string;
  commune_id: string | null;
  role: "resident" | "official" | "admin";
  status?: "active" | "suspended";
  permissions?: string[];
}


export interface AdminUserPatch {
  display_name?: string;
  commune_id?: string | null;
  role?: "resident" | "official" | "admin";
  status?: "active" | "suspended";
  permissions?: string[];
  password?: string;
}


export function listAdminUsers(): Promise<AuthUser[]> {
  return getJson(`${API_BASE}/api/admin/users?limit=500`);
}


export function createAdminUser(input: AdminUserInput): Promise<AuthUser> {
  return sendJson(`${API_BASE}/api/admin/users`, input);
}


export function updateAdminUser(userId: string, patch: AdminUserPatch): Promise<AuthUser> {
  return sendJson(`${API_BASE}/api/admin/users/${userId}`, patch, "PATCH");
}


export function deleteAdminUser(userId: string): Promise<void> {
  return deleteRequest(`${API_BASE}/api/admin/users/${userId}`);
}
