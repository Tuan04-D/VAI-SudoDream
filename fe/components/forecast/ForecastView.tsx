"use client";

import { useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  fetchCommunesGeoJson,
  fetchForecastMap,
  fetchProvinceGeoJson,
  fetchWarning,
} from "@/lib/api";
import type { Commune, ForecastDay, MapCommuneDay } from "@/lib/types";
import ForecastMap from "./ForecastMap";
import DaySlider from "./DaySlider";
import ScopeToggle from "./ScopeToggle";
import CommunePicker from "./CommunePicker";
import CommuneDetailCard from "./CommuneDetailCard";

const DAYS = [1, 2, 3, 4, 5];

export default function ForecastView({
  communes,
  defaultCommuneId,
}: {
  communes: Commune[];
  defaultCommuneId: string;
}) {
  const [focusCommuneId, setFocusCommuneId] = useState(defaultCommuneId);
  const [selectedDay, setSelectedDay] = useState(1);
  const [scope, setScope] = useState<"commune" | "province">("commune");

  const [provinceGeoJson, setProvinceGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [communesGeoJson, setCommunesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mapByDay, setMapByDay] = useState<Record<number, MapCommuneDay[]> | null>(null);
  const [warningText, setWarningText] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchProvinceGeoJson(),
      fetchCommunesGeoJson(),
      Promise.all(DAYS.map((d) => fetchForecastMap(d))),
    ])
      .then(([province, communesFc, dayResponses]) => {
        if (cancelled) return;
        setProvinceGeoJson(province);
        setCommunesGeoJson(communesFc);
        const byDay: Record<number, MapCommuneDay[]> = {};
        dayResponses.forEach((r) => {
          byDay[r.day_index] = r.communes;
        });
        setMapByDay(byDay);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWarning(focusCommuneId, selectedDay)
      .then((w) => !cancelled && setWarningText(w.warning_text_vi))
      .catch(() => !cancelled && setWarningText(undefined));
    return () => {
      cancelled = true;
    };
  }, [focusCommuneId, selectedDay]);

  const valueByCommune = useMemo(() => {
    if (!mapByDay) return {};
    const rows = mapByDay[selectedDay] || [];
    const out: Record<string, MapCommuneDay> = {};
    rows.forEach((r) => (out[r.commune_id] = r));
    return out;
  }, [mapByDay, selectedDay]);

  const domains = useMemo(() => {
    if (!mapByDay) return { temp: [15, 35] as [number, number], precip: [0, 100] as [number, number] };
    const all = Object.values(mapByDay).flat();
    const temps = all.map((r) => r.temp_downscaled);
    const precips = all.map((r) => r.precip_downscaled);
    return {
      temp: [Math.min(...temps), Math.max(...temps)] as [number, number],
      precip: [Math.min(...precips), Math.max(...precips)] as [number, number],
    };
  }, [mapByDay]);

  const focusCommune = communes.find((c) => c.id === focusCommuneId) ?? communes[0];

  const focusDays: ForecastDay[] = useMemo(() => {
    if (!mapByDay) return [];
    return DAYS.map((d) => {
      const row = (mapByDay[d] || []).find((r) => r.commune_id === focusCommuneId);
      return row as ForecastDay;
    }).filter(Boolean);
  }, [mapByDay, focusCommuneId]);

  const selectedFocusDay = focusDays.find((d) => d.day_index === selectedDay);

  function handleCommuneClick(id: string) {
    setFocusCommuneId(id);
    setScope("commune");
  }

  if (loadError) {
    return (
      <div className="mx-4 rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted lg:mx-8">
        Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
        <code className="font-data">{API_BASE}</code>.
      </div>
    );
  }

  const ready = provinceGeoJson && communesGeoJson && mapByDay;

  return (
    <div className="flex flex-col gap-3 px-4 lg:mx-auto lg:max-w-6xl lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ScopeToggle scope={scope} onChange={setScope} />
        <CommunePicker communes={communes} value={focusCommuneId} onChange={setFocusCommuneId} />
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MapPanel title="Nhiệt độ" ready={!!ready}>
            {ready && (
              <ForecastMap
                provinceGeoJson={provinceGeoJson}
                communesGeoJson={communesGeoJson}
                metric="temp"
                scope={scope}
                focusCommuneId={focusCommuneId}
                valueByCommune={valueByCommune}
                domain={domains.temp}
                onCommuneClick={handleCommuneClick}
              />
            )}
          </MapPanel>
          <MapPanel title="Lượng mưa" ready={!!ready}>
            {ready && (
              <ForecastMap
                provinceGeoJson={provinceGeoJson}
                communesGeoJson={communesGeoJson}
                metric="precip"
                scope={scope}
                focusCommuneId={focusCommuneId}
                valueByCommune={valueByCommune}
                domain={domains.precip}
                onCommuneClick={handleCommuneClick}
              />
            )}
          </MapPanel>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-20">
          {focusDays.length > 0 && (
            <DaySlider days={focusDays} selected={selectedDay} onSelect={setSelectedDay} />
          )}
          {focusCommune && selectedFocusDay && (
            <CommuneDetailCard commune={focusCommune} day={selectedFocusDay} warningText={warningText} />
          )}
        </div>
      </div>

      <p className="pb-4 text-center text-[11px] text-ink-muted lg:text-left">
        Dữ liệu dự báo hiện là dữ liệu mô phỏng phục vụ demo, chưa phải đầu ra model ML thật. Nhấn vào 1
        xã trên bản đồ để xem chi tiết.
      </p>
    </div>
  );
}

function MapPanel({ title, ready, children }: { title: string; ready: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <p className="border-b border-border px-3 py-1.5 text-xs font-semibold text-ink-muted">{title}</p>
      <div className="relative h-[32vh] sm:h-[38vh] lg:h-[44vh]">
        {!ready && <div className="skeleton absolute inset-0" />}
        {children}
      </div>
    </div>
  );
}
