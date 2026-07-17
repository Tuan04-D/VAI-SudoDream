"use client";

import { motion, AnimatePresence } from "motion/react";
import HazardIcon from "@/components/ui/HazardIcon";
import SpeakButton from "@/components/ui/SpeakButton";
import { RISK_BG_CLASS, RISK_LABEL } from "@/lib/risk";
import type { Commune, ForecastDay } from "@/lib/types";

export default function CommuneDetailCard({
  commune,
  day,
  warningText,
}: {
  commune: Commune;
  day: ForecastDay;
  warningText?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${commune.id}-${day.day_index}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {commune.name} · {day.date}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <HazardIcon type={day.hazard_type} className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold">{day.hazard_label}</span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-sm ${RISK_BG_CLASS[day.risk_level]} px-3 py-1 text-xs font-bold text-white`}
          >
            {RISK_LABEL[day.risk_level]}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Nhiệt độ" value={`${day.temp_downscaled}°C`} />
          <Stat label="Lượng mưa" value={`${day.precip_downscaled}mm`} />
          <Stat label="Độ tin cậy" value={`${Math.round(day.confidence * 100)}%`} />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink">
          {warningText || day.recommended_action}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <SpeakButton text={warningText || day.recommended_action} language="vietnamese" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-muted py-2.5 transition-colors hover:bg-primary/10">
      <p className="font-data text-base font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}
