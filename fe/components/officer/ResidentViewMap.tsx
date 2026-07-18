"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ViewedMapResident } from "@/lib/types";

export default function ResidentViewMap({ residents }: { residents: ViewedMapResident[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

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
      center: [103.0, 21.6],
      zoom: 8,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (residents.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    residents.forEach((r) => {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
      el.style.backgroundColor = r.viewed ? "#2e7d32" : "#c62828";
      el.title = `${r.display_name}${r.viewed ? " — đã xem" : " — chưa xem"}`;
      const marker = new maplibregl.Marker({ element: el }).setLngLat([r.lon, r.lat]).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([r.lon, r.lat]);
    });
    map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 400 });
  }, [residents]);

  return <div ref={containerRef} className="h-full w-full" />;
}
