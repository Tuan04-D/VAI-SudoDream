"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { DayForecast } from "@/lib/types";

export default function DaySlider({
  days,
  selected,
  onSelect,
}: {
  days: DayForecast[];
  selected: number;
  onSelect: (day: number) => void;
}) {
  const stops = days.map((d) => d.risk.color).join(", ");
  const trackStyle = { background: `linear-gradient(90deg, ${stops})` };

  return (
    <div className="card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Kéo để xem các ngày tới
      </p>
      <input
        type="range"
        min={0}
        max={(days.length || 5) - 1}
        step={1}
        value={selected}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="risk-slider w-full"
        style={trackStyle}
        aria-label="Chọn ngày dự báo"
      />
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {days.map((d) => {
          const active = d.day_index === selected;
          return (
            <button
              key={d.day_index}
              type="button"
              onClick={() => onSelect(d.day_index)}
              className="relative flex flex-col items-center gap-1 rounded-md py-1.5 text-xs transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="day-chip-active"
                  className="absolute inset-0 rounded-md bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className="relative z-10 h-2 w-2 rounded-full"
                style={{ backgroundColor: d.risk.color }}
                aria-hidden
              />
              <span className={clsx("relative z-10", active ? "font-semibold text-primary" : "text-ink-muted")}>
                {d.day_index === 0 ? "Hôm nay" : d.day_index === 1 ? "Mai" : `+${d.day_index}d`}
              </span>
              <span className="relative z-10 font-data text-[10px] text-ink-muted">
                {d.date?.slice(5) ?? ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
