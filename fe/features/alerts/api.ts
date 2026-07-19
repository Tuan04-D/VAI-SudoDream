import { API_BASE, apiFetch, getJson, getPublicJson, sendJson } from "@/lib/api/client";
import type { NotificationItem, ViewedMapResponse } from "@/lib/types";


export function fetchNotifications(limit = 20): Promise<NotificationItem[]> {
  return getPublicJson(`${API_BASE}/api/notifications?limit=${limit}`, 30);
}

export function fetchCommuneAlerts(communeId: string): Promise<NotificationItem[]> {
  return getPublicJson(`${API_BASE}/api/alerts?commune_id=${encodeURIComponent(communeId)}`, 8);
}

export function generateNotifications(): Promise<{ created: number }> {
  return sendJson(`${API_BASE}/api/notifications/generate`, {});
}

export function markAlertViewed(alertId: string, residentId: string): Promise<{ ok: boolean }> {
  void residentId;
  return sendJson(`${API_BASE}/api/alerts/${alertId}/view`, {});
}

export function fetchOfficerAlerts(communeId: string): Promise<NotificationItem[]> {
  return getJson(`${API_BASE}/api/officer/alerts?commune_id=${encodeURIComponent(communeId)}`);
}

export function fetchViewedMap(alertId: string): Promise<ViewedMapResponse> {
  return getJson(`${API_BASE}/api/officer/viewed-map?alert_id=${encodeURIComponent(alertId)}`);
}

export async function sendOfficerAlert(communeId: string, officialId?: string | null): Promise<NotificationItem> {
  void officialId;
  const response = await apiFetch(`${API_BASE}/api/officer/alerts/${communeId}/send`, { method: "POST" });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || response.statusText);
  return response.json();
}
