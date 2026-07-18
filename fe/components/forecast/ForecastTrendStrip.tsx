"use client";

import { useState } from "react";
import clsx from "clsx";
import { precipColor } from "@/lib/scale";
import type { DayForecast } from "@/lib/types";

const DAY_LABEL = (d: DayForecast) => (d.day_index === 0 ? "Hôm nay" : d.day_index === 1 ? "Mai" : `+${d.day_index}d`);

export default function ForecastTrendStrip({
  days,
  domain,
}: {
  days: DayForecast[];
  domain: [number, number];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(domain[1], 1);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Lượng mưa 5 ngày tới (mm)</p>
      <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 96 }}>
        {days.map((d) => {
          const value = d.rain_sum_mm ?? 0;
          const heightPercent = Math.max((value / max) * 100, value > 0 ? 6 : 2);
          const color = precipColor(value, domain);
          return (
            <div
              key={d.day_index}
              className="relative flex h-full w-full max-w-6 flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHovered(d.day_index)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === d.day_index && (
                <div className="absolute -top-7 z-10 rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                  {value.toFixed(1)}mm
                </div>
              )}
              <span className="font-data text-[10px] font-semibold text-ink-muted">
                {value > 0 ? Math.round(value) : ""}
              </span>
              <div
                className={clsx("mt-0.5 w-full max-w-5 rounded-t-sm transition-[height]")}
                style={{ height: `${heightPercent}%`, backgroundColor: color }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {days.map((d) => (
          <span key={d.day_index} className="flex-1 max-w-6 text-center text-[10px] text-ink-muted">
            {DAY_LABEL(d)}
          </span>
        ))}
      </div>
      <span className="sr-only">
        {days.map((d) => `${DAY_LABEL(d)}: ${(d.rain_sum_mm ?? 0).toFixed(1)}mm mưa. `).join("")}
      </span>
    </div>
  );
}
