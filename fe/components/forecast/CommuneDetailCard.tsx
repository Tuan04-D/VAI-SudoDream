"use client";

import { motion, AnimatePresence } from "motion/react";
import { IconSunrise, IconSunset } from "@tabler/icons-react";
import WeatherIcon, { FlashFloodIcon, LandslideIcon } from "@/components/ui/WeatherIcon";
import RiskChip from "@/components/ui/RiskChip";
import DayStatGrid from "./DayStatGrid";
import type { Commune, DayForecast } from "@/lib/types";

export default function CommuneDetailCard({
  commune,
  day,
}: {
  commune: Commune;
  day: DayForecast;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${commune.id}-${day.day_index}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="card p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {commune.name} · {day.day_index === 0 ? "Hôm nay" : day.date}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <WeatherIcon iconKey={day.icon_key} className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold">{day.condition ?? "—"}</span>
            </div>
          </div>
          <RiskChip risk={day.risk} className="shrink-0" />
        </div>

        <div className="mt-4">
          <DayStatGrid day={day} />
        </div>

        {(day.sunrise || day.sunset) && (
          <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-ink-muted">
            {day.sunrise && (
              <span className="inline-flex items-center gap-1.5">
                <IconSunrise className="h-4 w-4" stroke={2} /> Mọc {day.sunrise.slice(11, 16)}
              </span>
            )}
            {day.sunset && (
              <span className="inline-flex items-center gap-1.5">
                <IconSunset className="h-4 w-4" stroke={2} /> Lặn {day.sunset.slice(11, 16)}
              </span>
            )}
          </div>
        )}

        {(day.landslide || day.flash_flood) && (
          <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
            {day.landslide && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-risk-3">
                <LandslideIcon className="h-3.5 w-3.5" /> Nguy cơ sạt lở đất (cảnh báo NCHMF)
              </span>
            )}
            {day.flash_flood && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-risk-3">
                <FlashFloodIcon className="h-3.5 w-3.5" /> Nguy cơ lũ quét (cảnh báo NCHMF)
              </span>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
