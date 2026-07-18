"use client";

import { motion } from "motion/react";
import clsx from "clsx";
import { IconChartHistogram } from "@tabler/icons-react";
import WeatherIcon, {
  FrostIcon,
  HeavyRainIcon,
  StrongWindIcon,
  ThunderstormIcon,
} from "@/components/ui/WeatherIcon";
import type { DayForecast, ForecastConfidence, RiskInfo } from "@/lib/types";

const CONFIDENCE_DOT_CLASS: Record<ForecastConfidence["level"], string> = {
  high: "bg-risk-0",
  medium: "bg-risk-1",
  low: "bg-risk-2",
};

function ConfidenceNote({ confidence }: { confidence: ForecastConfidence }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
      <IconChartHistogram className="h-3.5 w-3.5 shrink-0" stroke={1.8} />
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", CONFIDENCE_DOT_CLASS[confidence.level])} />
      <span>
        Độ tin cậy dự báo: <span className="font-semibold text-ink">{confidence.label}</span>
        {" · chênh lệch mô hình ECMWF/GFS/ICON "}
        {confidence.spread_precip_mm != null && `${confidence.spread_precip_mm}mm mưa`}
        {confidence.spread_precip_mm != null && confidence.spread_temp_c != null && ", "}
        {confidence.spread_temp_c != null && `${confidence.spread_temp_c}°C`}
      </span>
    </div>
  );
}

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

const HAZARD_VIDEO: Record<string, string> = {
  landslide: "/landslide-demo.mp4",
  flash_flood: "/flash-flood-demo.mp4",
};

function renderHazardIcon(type: string, className: string, style: React.CSSProperties) {
  switch (type) {
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

function VideoHazardCard({ card, focused }: { card: HazardCardData; focused: boolean }) {
  return (
    <motion.div
      id={`hazard-${card.type}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: focused ? [1, 1.02, 1] : 1 }}
      transition={{ duration: 0.3, scale: { duration: 0.6, delay: 0.3 } }}
      className={clsx(
        "notice relative scroll-mt-24 overflow-hidden p-0",
        focused && "ring-2 ring-primary ring-offset-2 ring-offset-bg"
      )}
      style={{ borderLeftColor: card.severity.color, borderLeftWidth: 6 }}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-square">
        <video
          src={HAZARD_VIDEO[card.type]}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-bold text-white">{card.title}</p>
            <span
              className="shrink-0 rounded-sm px-2.5 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: card.severity.color }}
            >
              {card.severity.label}
            </span>
          </div>
          {card.official && <p className="text-xs font-semibold text-white/80">Cảnh báo chính thức NCHMF</p>}
          <p className="mt-1.5 text-sm leading-relaxed text-white/90">{HAZARD_ACTIONS[card.type]}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function HazardBoard({
  day,
  focusHazard,
}: {
  day: DayForecast;
  focusHazard?: string | null;
}) {
  const videoCards: HazardCardData[] = [];
  if (day.landslide) {
    videoCards.push({ type: "landslide", title: "Nguy cơ sạt lở đất", severity: day.landslide.severity, official: true });
  }
  if (day.flash_flood) {
    videoCards.push({ type: "flash_flood", title: "Nguy cơ lũ quét", severity: day.flash_flood.severity, official: true });
  }
  videoCards.sort((a, b) => b.severity.level - a.severity.level);

  const iconCards: HazardCardData[] = day.hazards
    .map((hazard) => ({ type: hazard.type, title: hazard.title, severity: hazard.severity, official: false }))
    .sort((a, b) => b.severity.level - a.severity.level);

  if (videoCards.length === 0 && iconCards.length === 0) {
    return (
      <div className="flex flex-col gap-2">
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
        {day.confidence && <ConfidenceNote confidence={day.confidence} />}
      </div>
    );
  }

  const [featured, ...rest] = iconCards;
  const featuredFocused = featured && focusHazard === featured.type;

  return (
    <div className="flex flex-col gap-3">
      {day.confidence && <ConfidenceNote confidence={day.confidence} />}

      {videoCards.length > 0 && (
        <div className={clsx("grid gap-3", videoCards.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {videoCards.map((card) => (
            <VideoHazardCard key={card.type} card={card} focused={focusHazard === card.type} />
          ))}
        </div>
      )}

      {featured && (
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
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {HAZARD_ACTIONS[featured.type] ?? "Theo dõi bản tin và làm theo hướng dẫn của cán bộ bản."}
              </p>
            </div>
          </div>
        </motion.div>
      )}

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
