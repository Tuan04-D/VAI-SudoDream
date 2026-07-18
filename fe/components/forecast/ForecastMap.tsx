"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { collectionBBox, featureBBox, bboxToLngLatBounds } from "@/lib/geo";
import { TEMP_MAPLIBRE_STOPS, PRECIP_MAPLIBRE_STOPS, buildMapLibreStops } from "@/lib/scale";
import type { MapCommuneDay } from "@/lib/types";

const RISK_COLOR_HEX: Record<number, string> = {
  0: "#2e7d32",
  1: "#f9a825",
  2: "#ef6c00",
  3: "#c62828",
};

const UNIT: Record<"temp" | "precip" | "risk", string> = { temp: "°C", precip: "mm", risk: "" };

function metricValue(row: MapCommuneDay, metric: "temp" | "precip" | "risk"): number | null {
  if (metric === "risk") return row.risk.level;
  if (metric === "precip") return row.rain_sum_mm;
  if (row.temp_max_c == null || row.temp_min_c == null) return null;
  return (row.temp_max_c + row.temp_min_c) / 2;
}

export default function ForecastMap({
  provinceGeoJson,
  communesGeoJson,
  metric,
  scope,
  focusCommuneId,
  valueByCommune,
  domain,
  onCommuneClick,
}: {
  provinceGeoJson: GeoJSON.FeatureCollection;
  communesGeoJson: GeoJSON.FeatureCollection;
  metric: "temp" | "precip" | "risk";
  scope: "commune" | "province";
  focusCommuneId: string;
  valueByCommune: Record<string, MapCommuneDay>;
  domain: [number, number];
  onCommuneClick?: (communeId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const valueByCommuneRef = useRef(valueByCommune);
  const onCommuneClickRef = useRef(onCommuneClick);

  useEffect(() => {
    valueByCommuneRef.current = valueByCommune;
    onCommuneClickRef.current = onCommuneClick;
  }, [valueByCommune, onCommuneClick]);

  // Create the map once.
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
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "forecast-map-popup",
    });
    popupRef.current = popup;

    map.on("load", () => {
      map.addSource("province", { type: "geojson", data: provinceGeoJson });
      map.addSource("communes", {
        type: "geojson",
        data: decorate(communesGeoJson, {}, "temp", [0, 1]),
        promoteId: "id",
      });

      map.addLayer({
        id: "province-outline",
        type: "line",
        source: "province",
        paint: { "line-color": "#2f4b8c", "line-width": 1.5, "line-opacity": 0.5 },
      });

      map.addLayer({
        id: "communes-fill",
        type: "fill",
        source: "communes",
        paint: {
          "fill-color":
            metric === "risk"
              ? [
                  "match",
                  ["get", "risk_level"],
                  0,
                  RISK_COLOR_HEX[0],
                  1,
                  RISK_COLOR_HEX[1],
                  2,
                  RISK_COLOR_HEX[2],
                  3,
                  RISK_COLOR_HEX[3],
                  RISK_COLOR_HEX[0],
                ]
              : [
                  "interpolate",
                  ["linear"],
                  ["get", "value_norm"],
                  ...buildMapLibreStops(metric === "temp" ? TEMP_MAPLIBRE_STOPS : PRECIP_MAPLIBRE_STOPS),
                ],
          "fill-opacity": [
            "case",
            ["==", ["get", "dimmed"], true],
            0.15,
            ["boolean", ["feature-state", "hover"], false],
            1,
            0.88,
          ],
        },
      });

      map.addLayer({
        id: "communes-outline",
        type: "line",
        source: "communes",
        paint: { "line-color": "#ffffff", "line-width": 0.6, "line-opacity": 0.6 },
      });

      map.addLayer({
        id: "risk-outline",
        type: "line",
        source: "communes",
        filter: [">=", ["get", "risk_level"], 2],
        paint: {
          "line-color": ["match", ["get", "risk_level"], 3, RISK_COLOR_HEX[3], 2, RISK_COLOR_HEX[2], "#000"],
          "line-width": 2.4,
        },
      });

      map.addLayer({
        id: "hover-outline",
        type: "line",
        source: "communes",
        filter: ["==", ["get", "id"], "__none__"],
        paint: { "line-color": "#1b2333", "line-width": 2.4 },
      });

      map.addLayer({
        id: "focus-outline",
        type: "line",
        source: "communes",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#2f4b8c", "line-width": 3.5 },
      });

      map.addLayer({
        id: "commune-labels",
        type: "symbol",
        source: "communes",
        layout: {
          "text-field": ["get", "short_name"],
          "text-size": 11,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1b2333",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });

      map.on("mousemove", "communes-fill", (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const id = String(feature.properties?.id);

        if (hoveredIdRef.current !== id) {
          if (hoveredIdRef.current) {
            map.setFeatureState({ source: "communes", id: hoveredIdRef.current }, { hover: false });
          }
          map.setFeatureState({ source: "communes", id }, { hover: true });
          map.setFilter("hover-outline", ["==", ["get", "id"], id]);
          hoveredIdRef.current = id;
        }

        map.getCanvas().style.cursor = "pointer";
        const row = valueByCommuneRef.current[id];
        const name = (feature.properties?.name as string) || "";
        const valueLabel = row
          ? metric === "risk"
            ? row.risk.label
            : metricValue(row, metric) != null
              ? `${metricValue(row, metric)}${UNIT[metric]}`
              : null
          : null;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="text-xs font-semibold text-ink">${name}</div>` +
              (valueLabel !== null
                ? `<div class="font-data text-sm font-bold text-primary">${valueLabel}</div>`
                : "")
          )
          .addTo(map);
      });

      map.on("mouseleave", "communes-fill", () => {
        if (hoveredIdRef.current) {
          map.setFeatureState({ source: "communes", id: hoveredIdRef.current }, { hover: false });
        }
        hoveredIdRef.current = null;
        map.setFilter("hover-outline", ["==", ["get", "id"], "__none__"]);
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", "communes-fill", (e) => {
        if (!e.features?.length) return;
        const id = String(e.features[0].properties?.id);
        onCommuneClickRef.current?.(id);
      });

      loadedRef.current = true;
      applyState();
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function decorate(
    fc: GeoJSON.FeatureCollection,
    values: Record<string, MapCommuneDay>,
    metricKey: "temp" | "precip" | "risk",
    dom: [number, number]
  ): GeoJSON.FeatureCollection {
    const [lo, hi] = dom;
    return {
      type: "FeatureCollection",
      features: fc.features.map((f) => {
        const id = String(f.properties?.id);
        const row = values[id];
        const raw = row ? metricValue(row, metricKey) : lo;
        const norm = hi === lo || raw == null ? 0.5 : Math.max(0, Math.min(1, (raw - lo) / (hi - lo)));
        const name = (f.properties?.name as string) || "";
        return {
          ...f,
          properties: {
            ...f.properties,
            value_norm: norm,
            risk_level: row?.risk.level ?? 0,
            short_name: name.replace(/^(Xã|Phường)\s+/i, ""),
            dimmed: scope === "commune" && id !== focusCommuneId,
          },
        };
      }),
    };
  }

  function applyState() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const source = map.getSource("communes") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(decorate(communesGeoJson, valueByCommune, metric, domain));
    }

    map.setFilter("focus-outline", ["==", ["get", "id"], scope === "commune" ? focusCommuneId : ""]);

    const targetBBox =
      scope === "commune"
        ? (() => {
            const feature = communesGeoJson.features.find((f) => String(f.properties?.id) === focusCommuneId);
            return feature ? featureBBox(feature) : collectionBBox(provinceGeoJson);
          })()
        : collectionBBox(provinceGeoJson);

    map.fitBounds(bboxToLngLatBounds(targetBBox), {
      padding: scope === "commune" ? 60 : 24,
      duration: 500,
      maxZoom: scope === "commune" ? 13 : 9.5,
    });
  }

  useEffect(() => {
    applyState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, scope, focusCommuneId, valueByCommune, domain]);

  return <div ref={containerRef} className="h-full w-full" />;
}
