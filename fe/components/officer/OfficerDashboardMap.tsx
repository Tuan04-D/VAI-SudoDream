"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCommuneHeatmap, fetchCommunesGeoJson, fetchProvinceGeoJson } from "@/lib/api";
import { precipColor, tempColor } from "@/lib/scale";
import type { TerrainHeatmap } from "@/lib/types";

const CANVAS_SIZE = 220;
const IDW_POWER = 2;
type Variable = "temperature" | "precipitation";

const VARIABLE_OPTIONS: { key: Variable; label: string }[] = [
  { key: "temperature", label: "Nhiệt độ (đã hiệu chỉnh địa hình)" },
  { key: "precipitation", label: "Lượng mưa (giá trị gốc, chưa hiệu chỉnh)" },
];

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInFeature(lon: number, lat: number, feature: GeoJSON.Feature | undefined): boolean {
  if (!feature) return false;
  const geometry = feature.geometry;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((rings) => pointInRing(lon, lat, rings[0]) && !rings.slice(1).some((hole) => pointInRing(lon, lat, hole)));
}

function featureBbox(feature: GeoJSON.Feature): [number, number, number, number] {
  const geometry = feature.geometry;
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];
  const coords = rings.flat();
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function interpolateValue(heatmap: TerrainHeatmap, lat: number, lon: number): number {
  let weightSum = 0;
  let valueSum = 0;
  for (const point of heatmap.points) {
    const distanceSquared = (point.lat - lat) ** 2 + (point.lon - lon) ** 2;
    const weight = 1 / Math.max(distanceSquared, 1e-8) ** (IDW_POWER / 2);
    weightSum += weight;
    valueSum += weight * point.value;
  }
  return valueSum / weightSum;
}

function renderHeatmapCanvas(
  heatmap: TerrainHeatmap,
  variable: Variable,
  bbox: [number, number, number, number],
  clipRings: { x: number; y: number }[][]
): string {
  const temps = heatmap.points.map((p) => p.value);
  const domain: [number, number] = [Math.min(...temps), Math.max(...temps)];
  if (domain[0] === domain[1]) {
    domain[0] -= 0.3;
    domain[1] += 0.3;
  }
  const colorFn = variable === "precipitation" ? precipColor : tempColor;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.beginPath();
  for (const ring of clipRings) {
    ring.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.closePath();
  }
  ctx.clip();

  const image = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
  const [minLon, minLat, maxLon, maxLat] = bbox;
  for (let py = 0; py < CANVAS_SIZE; py++) {
    const lat = maxLat - (py / CANVAS_SIZE) * (maxLat - minLat);
    for (let px = 0; px < CANVAS_SIZE; px++) {
      const lon = minLon + (px / CANVAS_SIZE) * (maxLon - minLon);
      const value = interpolateValue(heatmap, lat, lon);
      const hex = colorFn(value, domain);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const idx = (py * CANVAS_SIZE + px) * 4;
      image.data[idx] = r;
      image.data[idx + 1] = g;
      image.data[idx + 2] = b;
      image.data[idx + 3] = 235;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export default function OfficerDashboardMap({
  focusCommuneId,
  focusCommuneName,
  selectedDay,
}: {
  focusCommuneId: string;
  focusCommuneName: string;
  selectedDay: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const heatmapRef = useRef<TerrainHeatmap | null>(null);
  const variableRef = useRef<Variable>("temperature");
  const communesFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [variable, setVariable] = useState<Variable>("temperature");
  const [heatmap, setHeatmap] = useState<TerrainHeatmap | null>(null);
  const [error, setError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    variableRef.current = variable;
  }, [variable]);
  useEffect(() => {
    heatmapRef.current = heatmap;
  }, [heatmap]);

  // Map + province/commune outlines — created once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef0e8" } }],
      },
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "forecast-map-popup" });

    map.on("load", async () => {
      const [province, communesFc] = await Promise.all([fetchProvinceGeoJson(), fetchCommunesGeoJson()]);
      communesFcRef.current = communesFc;
      map.addSource("province", { type: "geojson", data: province });
      map.addLayer({ id: "province-outline", type: "line", source: "province", paint: { "line-color": "#2f4b8c", "line-width": 1.5, "line-opacity": 0.5 } });

      map.addSource("communes", { type: "geojson", data: communesFc });
      map.addLayer({
        id: "communes-outline",
        type: "line",
        source: "communes",
        paint: { "line-color": "#8b93a3", "line-width": 0.6, "line-opacity": 0.5 },
      });
      map.addLayer({ id: "focus-outline", type: "line", source: "communes", filter: ["==", ["get", "id"], ""], paint: { "line-color": "#1b2333", "line-width": 2.5 } });

      map.on("click", (event) => {
        const activeHeatmap = heatmapRef.current;
        const fc = communesFcRef.current;
        if (!activeHeatmap || !fc) return;
        const feature = fc.features.find((f) => String(f.properties?.id) === activeHeatmap.commune_id);
        if (!pointInFeature(event.lngLat.lng, event.lngLat.lat, feature)) return;
        const value = interpolateValue(activeHeatmap, event.lngLat.lat, event.lngLat.lng);
        const unit = variableRef.current === "precipitation" ? "mm" : "°C";
        const label = variableRef.current === "precipitation" ? "Lượng mưa" : "Nhiệt độ";
        popupRef.current
          ?.setLngLat(event.lngLat)
          .setHTML(`<div class="text-xs font-semibold text-ink">${label}</div><div class="font-data text-sm font-bold text-primary">${value.toFixed(1)}${unit}</div>`)
          .addTo(map);
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fetch + draw the focused commune's heatmap whenever commune/variable/day changes.
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    fetchCommuneHeatmap(focusCommuneId, variable, selectedDay)
      .then((heatmapData) => {
        if (cancelled) return;
        setError(false);
        setHeatmap(heatmapData);
        const map = mapRef.current;
        const fc = communesFcRef.current;
        if (!map || !fc) return;
        const feature = fc.features.find((f) => String(f.properties?.id) === focusCommuneId);
        if (!feature) return;

        const [minLon, minLat, maxLon, maxLat] = featureBbox(feature);
        const padLon = (maxLon - minLon) * 0.04 || 0.005;
        const padLat = (maxLat - minLat) * 0.04 || 0.005;
        const bbox: [number, number, number, number] = [minLon - padLon, minLat - padLat, maxLon + padLon, maxLat + padLat];

        const toPixel = (lon: number, lat: number) => ({
          x: ((lon - bbox[0]) / (bbox[2] - bbox[0])) * CANVAS_SIZE,
          y: (1 - (lat - bbox[1]) / (bbox[3] - bbox[1])) * CANVAS_SIZE,
        });
        const geometry = feature.geometry;
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
        const clipRings = polygons.map((rings) => rings[0].map(([lon, lat]) => toPixel(lon, lat)));

        const url = renderHeatmapCanvas(heatmapData, variable, bbox, clipRings);

        if (map.getLayer("terrain-heat")) map.removeLayer("terrain-heat");
        if (map.getSource("terrain-heat")) map.removeSource("terrain-heat");
        map.addSource("terrain-heat", {
          type: "image",
          url,
          coordinates: [
            [bbox[0], bbox[3]],
            [bbox[2], bbox[3]],
            [bbox[2], bbox[1]],
            [bbox[0], bbox[1]],
          ],
        });
        map.addLayer({ id: "terrain-heat", type: "raster", source: "terrain-heat", paint: { "raster-opacity": 0.82 } }, "focus-outline");

        map.setFilter("focus-outline", ["==", ["get", "id"], focusCommuneId]);
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 24, duration: 500 }
        );
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [focusCommuneId, variable, selectedDay, mapReady]);

  return (
    <article className="card relative min-h-[390px] overflow-hidden">
      <div ref={containerRef} className="h-full min-h-[390px] w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto rounded-sm bg-surface/90 px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-sm">
          {focusCommuneName}
        </div>
        <select
          value={variable}
          onChange={(event) => setVariable(event.target.value as Variable)}
          className="pointer-events-auto rounded-sm border border-border bg-surface/95 px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-sm outline-none"
        >
          {VARIABLE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {heatmap && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-sm bg-surface/90 px-2.5 py-1.5 text-[10px] text-ink-muted shadow-sm">
          {heatmap.corrected
            ? `Trung tâm xã: ${heatmap.reference_value}${heatmap.unit} · dao động theo địa hình · nhấn vào bản đồ để xem giá trị từng điểm`
            : `Giá trị trung bình toàn xã (Open-Meteo): ${heatmap.reference_value}${heatmap.unit} · chưa có hiệu chỉnh địa hình cho biến này`}
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/70 text-xs text-ink-muted">
          Chưa có dữ liệu bản đồ cho xã/ngày này.
        </div>
      )}
    </article>
  );
}
