"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchCommunesGeoJson, fetchProvinceGeoJson } from "@/lib/api";
import { bboxToLngLatBounds, featureBBox } from "@/lib/geo";
import type { ViewedMapResident } from "@/lib/types";

export default function ResidentViewMap({
  residents,
  communeId,
}: {
  residents: ViewedMapResident[];
  communeId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const communeIdRef = useRef(communeId);
  const [province, setProvince] = useState<GeoJSON.FeatureCollection | null>(null);
  const [communes, setCommunes] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    communeIdRef.current = communeId;
  }, [communeId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProvinceGeoJson(), fetchCommunesGeoJson()])
      .then(([provinceData, communeData]) => {
        if (cancelled) return;
        setProvince(provinceData);
        setCommunes(communeData);
      })
      .catch(() => {
        if (cancelled) return;
        setProvince(null);
        setCommunes(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !province || !communes) return;
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
      center: [103.0, 21.6],
      zoom: 8,
    });
    mapRef.current = map;

    map.on("load", () => {
      const activeCommuneId = communeIdRef.current;
      map.addSource("province", { type: "geojson", data: province });
      map.addSource("communes", { type: "geojson", data: communes });
      map.addLayer({
        id: "province-fill",
        type: "fill",
        source: "province",
        paint: { "fill-color": "#dfe4d9", "fill-opacity": 0.55 },
      });
      map.addLayer({
        id: "province-outline",
        type: "line",
        source: "province",
        paint: { "line-color": "#2f4b8c", "line-width": 1.5, "line-opacity": 0.45 },
      });
      map.addLayer({
        id: "communes-fill",
        type: "fill",
        source: "communes",
        paint: {
          "fill-color": ["case", ["==", ["get", "id"], activeCommuneId], "#2f4b8c", "#ffffff"],
          "fill-opacity": ["case", ["==", ["get", "id"], activeCommuneId], 0.2, 0.18],
        },
      });
      map.addLayer({
        id: "communes-outline",
        type: "line",
        source: "communes",
        paint: {
          "line-color": ["case", ["==", ["get", "id"], activeCommuneId], "#2f4b8c", "#ffffff"],
          "line-width": ["case", ["==", ["get", "id"], activeCommuneId], 3, 0.8],
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "commune-labels",
        type: "symbol",
        source: "communes",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1b2333",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });

      const focused = communes.features.find((feature) => String(feature.properties?.id) === activeCommuneId);
      if (focused) {
        map.fitBounds(bboxToLngLatBounds(featureBBox(focused)), {
          padding: 36,
          duration: 0,
          maxZoom: 12,
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [communes, province]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !communes || !map.isStyleLoaded()) return;
    const color = ["case", ["==", ["get", "id"], communeId], "#2f4b8c", "#ffffff"] as maplibregl.ExpressionSpecification;
    map.setPaintProperty("communes-fill", "fill-color", color);
    map.setPaintProperty("communes-outline", "line-color", color);
    const focused = communes.features.find((feature) => String(feature.properties?.id) === communeId);
    if (focused) {
      map.fitBounds(bboxToLngLatBounds(featureBBox(focused)), {
        padding: 36,
        duration: 350,
        maxZoom: 12,
      });
    }
  }, [communeId, communes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (residents.length === 0) return;

    residents.forEach((r) => {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
      el.style.backgroundColor = r.viewed ? "#2e7d32" : "#c62828";
      el.style.cursor = "pointer";
      el.setAttribute("aria-label", `${r.display_name}${r.viewed ? " — đã xem" : " — chưa xem"}`);
      const popupContent = document.createElement("div");
      const popupName = document.createElement("strong");
      const popupStatus = document.createElement("span");
      popupName.textContent = r.display_name;
      popupStatus.textContent = r.viewed ? "Đã xem cảnh báo" : "Chưa xem cảnh báo";
      popupContent.append(popupName, document.createElement("br"), popupStatus);
      const popup = new maplibregl.Popup({ closeButton: false, offset: 12 }).setDOMContent(popupContent);
      const marker = new maplibregl.Marker({ element: el }).setLngLat([r.lon, r.lat]).addTo(map);
      el.addEventListener("mouseenter", () => popup.setLngLat([r.lon, r.lat]).addTo(map));
      el.addEventListener("mouseleave", () => popup.remove());
      markersRef.current.push(marker);
    });
  }, [residents]);

  return (
    <div className="relative h-full w-full bg-surface-muted">
      <div ref={containerRef} className="h-full w-full" />
      {(!province || !communes) && <div className="skeleton absolute inset-0" />}
    </div>
  );
}
