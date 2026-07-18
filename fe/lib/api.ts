import type {
  ChatContext,
  ChatHistoryMessage,
  Commune,
  CommuneForecast,
  ForecastMapResponse,
  NotificationItem,
  Official,
  Resident,
  ViewedMapResponse,
  WarningResponse,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

export function fetchCommunes(): Promise<{ default_commune_id: string; communes: Commune[] }> {
  return getJson(`${API_BASE}/api/communes`);
}

export function fetchProvinceGeoJson(): Promise<GeoJSON.FeatureCollection> {
  return getJson(`${API_BASE}/api/geo/province`);
}

export function fetchCommunesGeoJson(): Promise<GeoJSON.FeatureCollection> {
  return getJson(`${API_BASE}/api/geo/communes`);
}

export function fetchForecast(communeId: string, days = 5): Promise<CommuneForecast> {
  return getJson(`${API_BASE}/api/forecast/${communeId}?days=${days}`);
}

/** day: 0 = today .. 4 = +4 days */
export function fetchForecastMap(day: number): Promise<ForecastMapResponse> {
  return getJson(`${API_BASE}/api/forecast/map?day=${day}`);
}

export function fetchWarning(communeId: string): Promise<WarningResponse> {
  return getJson(`${API_BASE}/api/warnings/${communeId}/latest`);
}

export function fetchNotifications(limit = 20): Promise<NotificationItem[]> {
  return getJson(`${API_BASE}/api/notifications?limit=${limit}`);
}

export async function generateNotifications(): Promise<{ created: number }> {
  const res = await fetch(`${API_BASE}/api/notifications/generate`, { method: "POST" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function fetchChatContext(communeId: string): Promise<ChatContext> {
  return getJson(`${API_BASE}/api/chat/context/${communeId}`);
}

export function registerResident(
  phone: string,
  password: string,
  displayName: string,
  communeId: string
): Promise<Resident> {
  return postJson(`${API_BASE}/api/residents/register`, {
    phone,
    password,
    display_name: displayName,
    commune_id: communeId,
  });
}

export function loginResident(phone: string, password: string): Promise<Resident> {
  return postJson(`${API_BASE}/api/residents/login`, { phone, password });
}

export function fetchResident(residentId: string): Promise<Resident> {
  return getJson(`${API_BASE}/api/residents/${residentId}`);
}

export function updateResidentProfile(
  residentId: string,
  displayName: string,
  communeId: string
): Promise<Resident> {
  return postJson(
    `${API_BASE}/api/residents/${residentId}`,
    { display_name: displayName, commune_id: communeId },
    "PATCH"
  );
}

export function registerOfficial(
  phone: string,
  password: string,
  displayName: string,
  communeId: string
): Promise<Official> {
  return postJson(`${API_BASE}/api/officials/register`, {
    phone,
    password,
    display_name: displayName,
    commune_id: communeId,
  });
}

export function loginOfficial(phone: string, password: string): Promise<Official> {
  return postJson(`${API_BASE}/api/officials/login`, { phone, password });
}

export function fetchOfficial(officialId: string): Promise<Official> {
  return getJson(`${API_BASE}/api/officials/${officialId}`);
}

export function fetchChatHistory(residentId: string): Promise<ChatHistoryMessage[]> {
  return getJson(`${API_BASE}/api/chat/history/${residentId}`);
}

export function markAlertViewed(alertId: string, residentId: string): Promise<{ ok: boolean }> {
  return postJson(`${API_BASE}/api/alerts/${alertId}/view`, { resident_id: residentId });
}

export function fetchOfficerAlerts(communeId: string): Promise<NotificationItem[]> {
  return getJson(`${API_BASE}/api/officer/alerts?commune_id=${communeId}`);
}

export function fetchViewedMap(alertId: string): Promise<ViewedMapResponse> {
  return getJson(`${API_BASE}/api/officer/viewed-map?alert_id=${alertId}`);
}

export async function sendOfficerAlert(communeId: string, officialId?: string | null): Promise<NotificationItem> {
  const url = new URL(`${API_BASE}/api/officer/alerts/${communeId}/send`);
  if (officialId) url.searchParams.set("official_id", officialId);
  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}
