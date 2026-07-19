"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCloudRain, IconTemperature } from "@tabler/icons-react";
import ForecastMap from "@/components/forecast/ForecastMap";
import {
  fetchCommunesGeoJson,
  fetchForecastMap,
  fetchProvinceGeoJson,
} from "@/lib/api";
import type { DayForecast, MapCommuneDay } from "@/lib/types";

type Metric = "temp" | "precip";

export default function OfficerDashboardMap({
  focusCommuneId,
  focusCommuneName,
  selectedDay,
  focusForecast,
}: {
  focusCommuneId: string;
  focusCommuneName: string;
  selectedDay: number;
  focusForecast?: DayForecast;
}) {
  const [metric, setMetric] = useState<Metric>("temp");
  const [province, setProvince] = useState<GeoJSON.FeatureCollection | null>(null);
  const [communes, setCommunes] = useState<GeoJSON.FeatureCollection | null>(null);
  const [rows, setRows] = useState<MapCommuneDay[]>([]);
  const [failed, setFailed] = useState(false);
  const [loadedDay, setLoadedDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProvinceGeoJson(), fetchCommunesGeoJson()])
      .then(([provinceData, communeData]) => {
        if (cancelled) return;
        setProvince(provinceData);
        setCommunes(communeData);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchForecastMap(selectedDay)
      .then((forecast) => {
        if (cancelled) return;
        setRows(forecast.communes);
        setLoadedDay(selectedDay);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedDay(selectedDay);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const visibleRows = useMemo(() => {
    if (!focusForecast || focusForecast.day_index !== selectedDay) return rows;
    const merged = new Map(rows.map((row) => [row.commune_id, row]));
    merged.set(focusForecast.commune_id, focusForecast);
    return [...merged.values()];
  }, [focusForecast, rows, selectedDay]);
  const valueByCommune = useMemo(
    () => Object.fromEntries(visibleRows.map((row) => [row.commune_id, row])),
    [visibleRows]
  );
  const domain = useMemo<[number, number]>(() => {
    const values = visibleRows
      .map((row) => metric === "precip"
        ? row.rain_sum_mm
        : row.temp_min_c != null && row.temp_max_c != null
          ? (row.temp_min_c + row.temp_max_c) / 2
          : null)
      .filter((value): value is number => value != null);
    return values.length
      ? [Math.min(...values), Math.max(...values)]
      : metric === "temp"
        ? [15, 35]
        : [0, 100];
  }, [metric, visibleRows]);

  return (
    <article className="card flex min-h-[390px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[11px] text-ink-muted">Bản đồ dự báo theo xã</p>
          <h2 className="font-display text-sm font-bold text-ink">{focusCommuneName}</h2>
        </div>
        <div className="inline-flex rounded-md bg-surface-muted p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMetric("temp")}
            aria-pressed={metric === "temp"}
            className={metric === "temp" ? "flex items-center gap-1 rounded-sm bg-surface px-2.5 py-1.5 text-primary shadow-sm ring-1 ring-primary/10" : "flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-ink-muted transition hover:bg-white/60 hover:text-ink"}
          >
            <IconTemperature className="h-3.5 w-3.5" /> Nhiệt độ
          </button>
          <button
            type="button"
            onClick={() => setMetric("precip")}
            aria-pressed={metric === "precip"}
            className={metric === "precip" ? "flex items-center gap-1 rounded-sm bg-surface px-2.5 py-1.5 text-primary shadow-sm ring-1 ring-primary/10" : "flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-ink-muted transition hover:bg-white/60 hover:text-ink"}
          >
            <IconCloudRain className="h-3.5 w-3.5" /> Lượng mưa
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-surface-muted">
        {province && communes ? (
          <ForecastMap
            provinceGeoJson={province}
            communesGeoJson={communes}
            metric={metric}
            scope="commune"
            focusCommuneId={focusCommuneId}
            valueByCommune={valueByCommune}
            domain={domain}
          />
        ) : (
          <div className="skeleton h-full min-h-[320px]" />
        )}
        {province && communes && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-48 rounded-md bg-white/92 p-2.5 shadow-lg ring-1 ring-ink/5 backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-bold text-ink">
              <span>{metric === "temp" ? "Nhiệt độ trung bình" : "Lượng mưa dự báo"}</span>
              <span className="font-data text-primary">{metric === "temp" ? "°C" : "mm"}</span>
            </div>
            <div
              className="mt-1.5 h-2 rounded-full"
              style={{
                background: metric === "temp"
                  ? "linear-gradient(90deg,#3155a5,#54a6d8,#f2cf58,#e35c36)"
                  : "linear-gradient(90deg,#eef5ff,#82b6df,#3477b8,#183b73)",
              }}
            />
            <div className="mt-1 flex justify-between font-data text-[9px] text-ink-muted">
              <span>{domain[0].toFixed(metric === "temp" ? 1 : 0)}</span>
              <span>{domain[1].toFixed(metric === "temp" ? 1 : 0)}</span>
            </div>
          </div>
        )}
        {loadedDay !== selectedDay && rows.length > 0 && (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[10px] font-bold text-primary shadow backdrop-blur-sm">
            Đang cập nhật lớp dữ liệu…
          </span>
        )}
        {failed && (
          <p className="absolute inset-x-4 bottom-4 rounded-md bg-surface/95 p-3 text-center text-xs text-risk-2 shadow">
            Chưa tải được dữ liệu bản đồ. Dữ liệu thời tiết dạng thẻ vẫn sử dụng bình thường.
          </p>
        )}
      </div>
    </article>
  );
}
