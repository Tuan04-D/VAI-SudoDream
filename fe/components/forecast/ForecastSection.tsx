"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import {
  API_BASE,
  fetchCommunesGeoJson,
  fetchForecast,
  fetchForecastMap,
  fetchProvinceGeoJson,
} from "@/lib/api";
import type { Commune, CommuneForecast, MapCommuneDay } from "@/lib/types";
import ForecastMap from "./ForecastMap";
import DaySlider from "./DaySlider";
import ScopeToggle from "./ScopeToggle";
import CommunePicker from "./CommunePicker";
import CommuneDetailCard from "./CommuneDetailCard";
import CurrentConditions from "./CurrentConditions";
import BulletinCard from "./BulletinCard";
import HazardBoard from "./HazardBoard";
import ForecastTrendStrip from "./ForecastTrendStrip";

const DAYS = [0, 1, 2, 3, 4];

export default function ForecastSection({
  communes,
  defaultCommuneId,
}: {
  communes: Commune[];
  defaultCommuneId: string;
}) {
  const searchParams = useSearchParams();
  const communeParam = searchParams.get("commune");
  const hazardParam = searchParams.get("hazard");
  const urlCommuneId =
    communeParam && communes.some((c) => c.id === communeParam) ? communeParam : defaultCommuneId;

  const [focusCommuneId, setFocusCommuneId] = useState(urlCommuneId);
  const [syncedCommuneId, setSyncedCommuneId] = useState(urlCommuneId);
  const [selectedDay, setSelectedDay] = useState(0);
  const [scope, setScope] = useState<"commune" | "province">("commune");

  if (urlCommuneId !== syncedCommuneId) {
    setSyncedCommuneId(urlCommuneId);
    setFocusCommuneId(urlCommuneId);
  }

  const [provinceGeoJson, setProvinceGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [communesGeoJson, setCommunesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mapByDay, setMapByDay] = useState<Record<number, MapCommuneDay[]> | null>(null);
  const [focusForecast, setFocusForecast] = useState<CommuneForecast | null>(null);
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
    fetchForecast(focusCommuneId)
      .then((data) => !cancelled && setFocusForecast(data))
      .catch(() => !cancelled && setFocusForecast(null));
    return () => {
      cancelled = true;
    };
  }, [focusCommuneId]);

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
    const temps = all.filter((r) => r.temp_min_c != null && r.temp_max_c != null).map((r) => (r.temp_min_c! + r.temp_max_c!) / 2);
    const precips = all.map((r) => r.rain_sum_mm ?? 0);
    return {
      temp: temps.length ? [Math.min(...temps), Math.max(...temps)] : [15, 35],
      precip: precips.length ? [Math.min(...precips), Math.max(...precips)] : [0, 100],
    } as { temp: [number, number]; precip: [number, number] };
  }, [mapByDay]);

  const focusCommune = communes.find((c) => c.id === focusCommuneId) ?? communes[0];
  const selectedDayData = focusForecast?.forecast.find((d) => d.day_index === selectedDay);

  function handleCommuneClick(id: string) {
    setFocusCommuneId(id);
    setScope("commune");
  }

  useEffect(() => {
    if (!hazardParam || !selectedDayData) return;
    const el = document.getElementById(`hazard-${hazardParam}`);
    if (!el) return;
    const timer = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    return () => clearTimeout(timer);
  }, [hazardParam, selectedDayData]);

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
    <div className="flex flex-col gap-4 px-4 lg:mx-auto lg:max-w-[1700px] lg:px-8">
      <header>
        <h2 className="font-display text-2xl font-bold">Dự báo</h2>
        <p className="text-sm text-ink-muted">Nhiệt độ, lượng mưa và cảnh báo sạt lở/lũ quét 5 ngày tới</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ScopeToggle scope={scope} onChange={setScope} />
        <CommunePicker communes={communes} value={focusCommuneId} onChange={setFocusCommuneId} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {mapByDay && (
        <DaySlider
          days={DAYS.map((d) => (mapByDay[d] || []).find((r) => r.commune_id === focusCommuneId)).filter(Boolean) as MapCommuneDay[]}
          selected={selectedDay}
          onSelect={setSelectedDay}
        />
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Nguy cơ thiên tai — {focusCommune?.name}
        </p>
        {selectedDayData ? (
          <HazardBoard day={selectedDayData} focusHazard={hazardParam} />
        ) : (
          <div className="skeleton h-24 rounded-lg" />
        )}
      </div>

      {focusForecast && <ForecastTrendStrip days={focusForecast.forecast} domain={domains.precip} />}

      <details className="group rounded-lg border border-border bg-surface-muted/40">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink-muted marker:content-none">
          <span className="inline-flex items-center gap-1.5">
            Chi tiết số liệu
            <IconChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" stroke={2.2} />
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-3">
          <CurrentConditions current={focusForecast?.current ?? null} />
          {focusCommune && selectedDayData && (
            <CommuneDetailCard commune={focusCommune} day={selectedDayData} />
          )}
          {focusForecast && (
            <BulletinCard
              bulletin={focusForecast.bulletin}
              dataQuality={focusForecast.data_quality}
              dataSources={focusForecast.data_sources}
              disclaimer={focusForecast.disclaimer}
              source={focusForecast.source}
            />
          )}
        </div>
      </details>

      <p className="pb-2 text-center text-[11px] text-ink-muted lg:text-left">
        Dữ liệu thời tiết (Open-Meteo) và cảnh báo sạt lở/lũ quét (NCHMF) là dữ liệu thật. Mức rủi ro của
        các ngày sau hôm nay là sàng lọc tự động từ dự báo mô hình, không phải cảnh báo chính thức. Nhấn
        vào 1 xã trên bản đồ để xem chi tiết.
      </p>
    </div>
  );
}

function MapPanel({ title, ready, children }: { title: string; ready: boolean; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <p className="border-b border-border px-3 py-1.5 text-xs font-semibold text-ink-muted">{title}</p>
      <div className="relative h-[42vh] sm:h-[52vh] lg:h-[68vh]">
        {!ready && <div className="skeleton absolute inset-0" />}
        {children}
      </div>
    </div>
  );
}
