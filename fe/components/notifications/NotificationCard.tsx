"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { IconArrowRight } from "@tabler/icons-react";
import AudioPlayButton from "@/components/ui/AudioPlayButton";
import Markdown from "@/components/ui/Markdown";
import type { NotificationItem } from "@/lib/types";

export default function NotificationCard({ item }: { item: NotificationItem }) {
  const color = item.risk_color;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className="notice p-4"
      style={{ borderLeftColor: color }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink">{item.commune_name}</p>
          <span
            className="shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {item.risk_label}
          </span>
        </div>
        <p className="text-xs text-ink-muted">{item.date}</p>
        <Markdown text={item.message_vi} className="mt-1.5" />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AudioPlayButton src={item.audio_url} label="Nghe (Hmoob)" />
          <Link
            href={`/quan-ly?commune=${item.commune_id}${item.hazard_type ? `&hazard=${item.hazard_type}` : ""}#du-bao`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-dark"
          >
            Xem chi tiết <IconArrowRight className="h-3.5 w-3.5" stroke={2} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
