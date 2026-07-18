import { API_BASE, getJson } from "@/lib/api/client";
import type { Commune, CommuneForecast, ForecastMapResponse, WarningResponse } from "@/lib/types";


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

export function fetchForecastMap(day: number): Promise<ForecastMapResponse> {
  return getJson(`${API_BASE}/api/forecast/map?day=${day}`);
}

export function fetchWarning(communeId: string): Promise<WarningResponse> {
  return getJson(`${API_BASE}/api/warnings/${communeId}/latest`);
}
