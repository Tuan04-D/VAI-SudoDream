"use client";

import { motion } from "motion/react";
import clsx from "clsx";
import WeatherIcon, {
  FlashFloodIcon,
  FrostIcon,
  HeavyRainIcon,
  LandslideIcon,
  StrongWindIcon,
  ThunderstormIcon,
} from "@/components/ui/WeatherIcon";
import type { DayForecast, RiskInfo } from "@/lib/types";

const HAZARD_ACTIONS: Record<string, string> = {
  landslide: "Rời xa sườn dốc, taluy — di chuyển đến nơi an toàn.",
  flash_flood: "Không qua suối, khe khi nước dâng — tránh vùng trũng thấp.",
  heavy_rain: "Hạn chế ra ngoài, đề phòng ngập úng, sạt lở.",
  moderate_rain: "Theo dõi thời tiết, chuẩn bị phương án nếu mưa to hơn.",
  frost: "Giữ ấm người già, trẻ nhỏ, che chắn cây trồng, vật nuôi.",
  strong_wind: "Gia cố mái nhà, tránh xa cây to, cột điện.",
  thunderstorm: "Tránh trú dưới cây to, tắt thiết bị điện khi có sét.",
  thunderstorm_hail: "Trú nơi kiên cố, tránh xa cửa kính, tắt thiết bị điện.",
};

function renderHazardIcon(type: string, className: string, style: React.CSSProperties) {
  switch (type) {
    case "landslide":
      return <LandslideIcon className={className} style={style} />;
    case "flash_flood":
      return <FlashFloodIcon className={className} style={style} />;
    case "heavy_rain":
    case "moderate_rain":
      return <HeavyRainIcon className={className} style={style} />;
    case "frost":
      return <FrostIcon className={className} style={style} />;
    case "strong_wind":
      return <StrongWindIcon className={className} style={style} />;
    case "thunderstorm":
    case "thunderstorm_hail":
      return <ThunderstormIcon className={className} style={style} />;
    default:
      return null;
  }
}

interface HazardCardData {
  type: string;
  title: string;
  severity: RiskInfo;
  official: boolean;
}

function HazardIconBadge({ card, size }: { card: HazardCardData; size: "lg" | "sm" }) {
  const box = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const icon = size === "lg" ? "h-9 w-9" : "h-5 w-5";
  return (
    <span
      className={clsx("relative flex shrink-0 items-center justify-center rounded-full", box)}
      style={{ backgroundColor: `color-mix(in srgb, ${card.severity.color} 14%, transparent)` }}
    >
      {card.severity.level === 3 && (
        <span
          className="hazard-pulse absolute inset-0 rounded-full"
          style={{ backgroundColor: card.severity.color }}
          aria-hidden
        />
      )}
      {renderHazardIcon(card.type, clsx("relative", icon), { color: card.severity.color })}
    </span>
  );
}

export default function HazardBoard({
  day,
  focusHazard,
}: {
  day: DayForecast;
  focusHazard?: string | null;
}) {
  const cards: HazardCardData[] = [];
  if (day.landslide) {
    cards.push({ type: "landslide", title: "Nguy cơ sạt lở đất", severity: day.landslide.severity, official: true });
  }
  if (day.flash_flood) {
    cards.push({ type: "flash_flood", title: "Nguy cơ lũ quét", severity: day.flash_flood.severity, official: true });
  }
  for (const hazard of day.hazards) {
    cards.push({ type: hazard.type, title: hazard.title, severity: hazard.severity, official: false });
  }
  cards.sort((a, b) => b.severity.level - a.severity.level);

  if (cards.length === 0) {
    return (
      <div className="notice p-5" style={{ borderLeftColor: "var(--color-risk-0)" }}>
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--color-risk-0) 14%, transparent)" }}
          >
            <WeatherIcon iconKey={day.icon_key} className="h-9 w-9 text-risk-0" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink">Chưa có cảnh báo nguy hiểm</p>
            <p className="text-sm text-ink-muted">{day.condition ?? "Thời tiết bình thường"}</p>
          </div>
        </div>
      </div>
    );
  }

  const [featured, ...rest] = cards;
  const featuredFocused = focusHazard === featured.type;

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        key={featured.type}
        id={`hazard-${featured.type}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, scale: featuredFocused ? [1, 1.02, 1] : 1 }}
        transition={{ duration: 0.3, scale: { duration: 0.6, delay: 0.3 } }}
        className={clsx(
          "notice scroll-mt-24 p-5",
          featuredFocused && "ring-2 ring-primary ring-offset-2 ring-offset-bg"
        )}
        style={{ borderLeftColor: featured.severity.color, borderLeftWidth: 6 }}
      >
        <div className="flex items-start gap-4">
          <HazardIconBadge card={featured} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-xl font-bold text-ink">{featured.title}</p>
              <span
                className="shrink-0 rounded-sm px-2.5 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: featured.severity.color }}
              >
                {featured.severity.label}
              </span>
            </div>
            {featured.official && (
              <p className="text-xs font-semibold text-ink-muted">Cảnh báo chính thức NCHMF</p>
            )}
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {HAZARD_ACTIONS[featured.type] ?? "Theo dõi bản tin và làm theo hướng dẫn của cán bộ bản."}
            </p>
          </div>
        </div>
      </motion.div>

      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rest.map((card) => {
            const focused = focusHazard === card.type;
            return (
              <motion.div
                key={card.type}
                id={`hazard-${card.type}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, scale: focused ? [1, 1.03, 1] : 1 }}
                transition={{ duration: 0.25, scale: { duration: 0.6, delay: 0.3 } }}
                className={clsx(
                  "notice scroll-mt-24 flex items-center gap-3 p-3",
                  focused && "ring-2 ring-primary ring-offset-2 ring-offset-bg"
                )}
                style={{ borderLeftColor: card.severity.color }}
              >
                <HazardIconBadge card={card} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{card.title}</p>
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: card.severity.color }}>
                      {card.severity.label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink-muted">
                    {HAZARD_ACTIONS[card.type] ?? "Theo dõi bản tin và cán bộ bản."}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
