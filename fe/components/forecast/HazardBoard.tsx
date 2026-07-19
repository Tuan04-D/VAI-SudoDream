"use client";

import { motion } from "motion/react";
import clsx from "clsx";
import {
  IconChartHistogram,
  IconMapPin,
  IconMountain,
  IconRadio,
  IconRoute,
  IconShieldCheck,
  IconTrees,
} from "@tabler/icons-react";
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

function VillageWatchItem({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-md bg-white/70 p-3 ring-1 ring-primary/10 backdrop-blur-sm">
      <span className="mt-0.5 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div>
        <p className="text-xs font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{detail}</p>
      </div>
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
      whileHover={{ y: -2 }}
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
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-ink/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          <IconMountain className="h-3.5 w-3.5" stroke={1.8} /> Tín hiệu địa hình
        </div>
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
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card relative overflow-hidden bg-gradient-to-br from-white via-white to-primary/10 p-5 sm:p-6"
          aria-label="Tình hình an toàn tại địa bàn"
        >
          <div className="bg-contour pointer-events-none absolute inset-0 opacity-45" aria-hidden />
          <svg
            viewBox="0 0 420 100"
            className="pointer-events-none absolute bottom-0 right-0 h-28 w-2/3 text-primary opacity-[0.07]"
            fill="currentColor"
            aria-hidden
          >
            <path d="M0 100 76 40l40 33 72-65 56 57 40-31 42 44 48-28 46 50Z" />
          </svg>

          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-risk-0/10 text-risk-0 ring-1 ring-risk-0/15">
                  <IconShieldCheck className="h-8 w-8" stroke={1.6} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-ink sm:text-xl">Bản tin địa bàn đang ổn định</h2>
                    <span className="rounded-full bg-risk-0/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-risk-0">
                      Chưa có cảnh báo
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                    <WeatherIcon iconKey={day.icon_key} className="h-5 w-5 text-primary" />
                    {day.condition ?? "Thời tiết bình thường"}
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-sm bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary-dark">
                <IconRadio className="h-3.5 w-3.5" stroke={1.8} /> Theo dõi theo xã
              </span>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              <VillageWatchItem icon={<IconTrees />} title="Sườn dốc và taluy" detail="Để ý vết nứt mới, đất đá rơi hoặc cây nghiêng." />
              <VillageWatchItem icon={<IconMountain />} title="Khe suối đầu nguồn" detail="Không xuống suối nếu nước đục hoặc dâng bất thường." />
              <VillageWatchItem icon={<IconRoute />} title="Đường vào bản" detail="Đi chậm khi mưa và báo cán bộ nếu đường sụt lún." />
            </div>
          </div>
        </motion.section>
        {day.confidence && <ConfidenceNote confidence={day.confidence} />}
      </div>
    );
  }

  const [featured, ...rest] = iconCards;
  const featuredFocused = featured && focusHazard === featured.type;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            <IconMountain className="h-4 w-4" stroke={1.8} /> Tín hiệu tại bản
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-ink">Nguy cơ cần chú ý hôm nay</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
          <IconRadio className="h-3.5 w-3.5 text-risk-3" stroke={1.8} /> Cập nhật theo địa bàn xã
        </span>
      </div>
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
          whileHover={{ y: -2 }}
          className={clsx(
            "notice relative scroll-mt-24 overflow-hidden p-5",
            featuredFocused && "ring-2 ring-primary ring-offset-2 ring-offset-bg"
          )}
          style={{ borderLeftColor: featured.severity.color, borderLeftWidth: 6 }}
        >
          <div className="bg-contour pointer-events-none absolute inset-0 opacity-30" aria-hidden />
          <div className="relative flex items-start gap-4">
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
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-ink-muted">
                <span className="inline-flex items-center gap-1"><IconMapPin className="h-3.5 w-3.5 text-primary" /> Địa bàn xã đang xem</span>
                <span className="inline-flex items-center gap-1"><IconRadio className="h-3.5 w-3.5 text-primary" /> Dữ liệu đang cập nhật</span>
              </div>
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
                whileHover={{ y: -2 }}
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
