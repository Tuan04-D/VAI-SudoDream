"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { Commune, ForecastDay } from "@/lib/types";
import { RISK_LABEL, RISK_BG_CLASS } from "@/lib/risk";
import HazardIcon from "@/components/ui/HazardIcon";

export default function RiskHeroCard({
  commune,
  today,
}: {
  commune: Commune;
  today: ForecastDay;
}) {
  const isCalm = today.risk_level === "thap";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
    >
      <Link
        href="/du-bao"
        className="group block overflow-hidden rounded-lg bg-surface shadow-2xl shadow-black/40 transition-shadow hover:shadow-black/50"
      >
        <div className={`bg-contour-light relative overflow-hidden ${RISK_BG_CLASS[today.risk_level]} px-6 py-5 text-white`}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Hôm nay · {commune.name}
          </p>
          <div className="mt-2 flex items-center gap-3.5">
            <HazardIcon type={today.hazard_type} className="h-10 w-10 shrink-0" />
            <div>
              <p className="font-display text-2xl font-bold leading-tight">
                Mức {RISK_LABEL[today.risk_level]}
              </p>
              <p className="text-sm opacity-95">{today.hazard_label}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm leading-relaxed text-ink">
            {isCalm ? "Thời tiết ổn định, chưa có nguy cơ." : today.recommended_action}
          </p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Xem bản đồ dự báo 5 ngày
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
