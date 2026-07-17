"use client";

import Link from "next/link";
import { motion } from "motion/react";
import HazardIcon from "@/components/ui/HazardIcon";
import AudioPlayButton from "@/components/ui/AudioPlayButton";
import { RISK_LABEL, RISK_TEXT_CLASS } from "@/lib/risk";
import type { NotificationItem } from "@/lib/types";

export default function NotificationCard({ item }: { item: NotificationItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${RISK_TEXT_CLASS[item.risk_level]}`}>
          <HazardIcon type={item.hazard_type} className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-ink">{item.commune_name}</p>
            <span className={`shrink-0 text-xs font-bold ${RISK_TEXT_CLASS[item.risk_level]}`}>
              {RISK_LABEL[item.risk_level]}
            </span>
          </div>
          <p className="text-xs text-ink-muted">{item.date}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{item.message_vi}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AudioPlayButton src={item.audio_url} label="Nghe (Hmoob)" />
            <Link
              href={`/du-bao?commune=${item.commune_id}`}
              className="text-xs font-semibold text-primary transition-colors hover:text-primary-dark"
            >
              Xem chi tiết →
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
