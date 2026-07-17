import type {
  ChatContext,
  Commune,
  ForecastMapResponse,
  ForecastResponse,
  NotificationItem,
  WarningResponse,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
export const CHATBOT_API_BASE = process.env.NEXT_PUBLIC_CHATBOT_API_BASE || "http://localhost:8001";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
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

export function fetchForecast(communeId: string, days = 5): Promise<ForecastResponse> {
  return getJson(`${API_BASE}/api/forecast/${communeId}?days=${days}`);
}

export function fetchForecastMap(day: number): Promise<ForecastMapResponse> {
  return getJson(`${API_BASE}/api/forecast/map?day=${day}`);
}

export function fetchWarning(communeId: string, day: number): Promise<WarningResponse> {
  return getJson(`${API_BASE}/api/warnings/${communeId}/latest?day=${day}`);
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
