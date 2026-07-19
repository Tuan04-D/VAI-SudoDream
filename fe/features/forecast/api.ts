import { API_BASE, getPublicJson } from "@/lib/api/client";
import type { Commune, CommuneForecast, ForecastMapResponse, WarningResponse } from "@/lib/types";


export function fetchCommunes(): Promise<{ default_commune_id: string; communes: Commune[] }> {
  return getPublicJson(`${API_BASE}/api/communes`, 3600);
}

export function fetchProvinceGeoJson(): Promise<GeoJSON.FeatureCollection> {
  return getPublicJson(`${API_BASE}/api/geo/province`, 86400);
}

export function fetchCommunesGeoJson(): Promise<GeoJSON.FeatureCollection> {
  return getPublicJson(`${API_BASE}/api/geo/communes`, 86400);
}

export function fetchForecast(communeId: string, days = 5): Promise<CommuneForecast> {
  return getPublicJson(`${API_BASE}/api/forecast/${communeId}?days=${days}`, 120);
}

export function fetchForecastMap(day: number): Promise<ForecastMapResponse> {
  return getPublicJson(`${API_BASE}/api/forecast/map?day=${day}`, 120);
}

export function fetchWarning(communeId: string): Promise<WarningResponse> {
  return getPublicJson(`${API_BASE}/api/warnings/${communeId}/latest`, 60);
}
