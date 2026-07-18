"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { IconArrowRight } from "@tabler/icons-react";
import type { Commune, CurrentWeather, DayForecast } from "@/lib/types";
import { riskBg } from "@/lib/risk";
import WeatherIcon, { FlashFloodIcon, LandslideIcon } from "@/components/ui/WeatherIcon";

export default function RiskHeroCard({
  commune,
  today,
  current,
}: {
  commune: Commune;
  today: DayForecast | undefined;
  current: CurrentWeather | null;
}) {
  if (!today) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="rounded-lg border border-white/15 bg-white/10 p-5 text-sm text-white/85 backdrop-blur">
          <p className="font-semibold">{commune.name}</p>
          <p className="mt-1">
            Chưa lấy được dữ liệu dự báo — AI service (cổng 8002) có thể chưa chạy. Xem hướng dẫn trong{" "}
            <code className="font-data">NOTES.md</code>.
          </p>
        </div>
      </motion.div>
    );
  }

  const temp = current?.temperature_c ?? today.temp_max_c;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
      <Link
        href="/quan-ly#du-bao"
        className="group block overflow-hidden rounded-lg bg-surface shadow-2xl shadow-black/40 transition-shadow hover:shadow-black/50"
      >
        <div className={`bg-contour-light relative overflow-hidden ${riskBg(today.risk)} px-6 py-5 text-white`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-90">{commune.name}</p>
              <p className="mt-0.5 text-sm font-medium opacity-95">{today.condition ?? "Đang cập nhật"}</p>
            </div>
            <WeatherIcon iconKey={current?.icon_key ?? today.icon_key} className="h-9 w-9 shrink-0" />
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-display text-5xl font-extrabold leading-none tabular-nums">
              {temp != null ? Math.round(temp) : "--"}°
            </span>
            <span className="mb-1 text-sm opacity-90">
              {today.temp_min_c != null && today.temp_max_c != null
                ? `${Math.round(today.temp_min_c)}° / ${Math.round(today.temp_max_c)}°`
                : ""}
            </span>
            <span className="mb-1 ml-auto rounded-sm bg-black/20 px-2 py-1 text-xs font-bold">
              {today.risk.label}
            </span>
          </div>
        </div>

        {(today.landslide || today.flash_flood) && (
          <div className="flex flex-col gap-1.5 border-b border-border bg-surface-muted px-6 py-2.5">
            {today.landslide && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-risk-3">
                <LandslideIcon className="h-3.5 w-3.5" /> Nguy cơ sạt lở đất — cảnh báo NCHMF
              </span>
            )}
            {today.flash_flood && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-risk-3">
                <FlashFloodIcon className="h-3.5 w-3.5" /> Nguy cơ lũ quét — cảnh báo NCHMF
              </span>
            )}
          </div>
        )}

        <div className="px-6 py-4">
          <p className="text-sm leading-relaxed text-ink">
            {today.rain_sum_mm != null
              ? `Lượng mưa dự kiến hôm nay khoảng ${today.rain_sum_mm}mm.`
              : "Chưa có dữ liệu mưa."}
          </p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Xem bản đồ dự báo 5 ngày
            <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" stroke={2.2} />
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
