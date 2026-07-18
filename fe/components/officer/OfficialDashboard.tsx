"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { IconShieldCheck } from "@tabler/icons-react";
import RiskHeroCard from "@/components/home/RiskHeroCard";
import HeroVideo from "@/components/home/HeroVideo";
import Section from "@/components/layout/Section";
import ForecastSection from "@/components/forecast/ForecastSection";
import NotificationsSection from "@/components/notifications/NotificationsSection";
import ChatSection from "@/components/chat/ChatSection";
import ResidentViewMapSection from "@/components/officer/ResidentViewMapSection";
import PhoneAuthForm from "@/components/auth/PhoneAuthForm";
import { useRole } from "@/lib/RoleProvider";
<<<<<<< Updated upstream
import { loginOfficial, registerOfficial } from "@/lib/api";
import type { Commune, CommuneForecast, NotificationItem } from "@/lib/types";
=======
import { RISK_TEXT_CLASS } from "@/lib/risk";
import {
  fetchForecast,
  loginOfficial,
  registerOfficial,
  sendOfficerAlert,
} from "@/lib/api";
import type {
  Commune,
  CommuneForecast,
  DayForecast,
  RiskInfo,
} from "@/lib/types";
import OfficerDashboardMap from "./OfficerDashboardMap";

function numberOrDash(value: number | null, suffix = "") {
  return value == null ? "—" : `${Math.round(value)}${suffix}`;
}

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(dateFromIso(value));
}

function dayName(day: DayForecast) {
  if (day.day_index === 0) return "Hôm nay";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" })
    .format(dateFromIso(day.date))
    .replace(/^./, (letter) => letter.toLocaleUpperCase("vi"));
}

function windDirection(degrees: number | null) {
  if (degrees == null) return "—";
  const directions = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
  return directions[Math.round(degrees / 45) % 8];
}
>>>>>>> Stashed changes

function OfficialGate({ communes }: { communes: Commune[] }) {
  const { setOfficial } = useRole();
  const defaultCommuneId = communes[0]?.id ?? "";
  return (
<<<<<<< Updated upstream
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-5 px-5 py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconShieldCheck className="h-9 w-9" stroke={1.8} />
=======
    <main className="bg-contour min-h-[calc(100dvh-74px)] bg-bg px-5 py-12">
      <div className="mx-auto grid min-h-[70vh] max-w-4xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-sm bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <IconBuildingCommunity className="h-4 w-4" /> Khu vực dành cho cán bộ xã
          </span>
          <h1 className="font-display mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.03em] text-ink">
            Theo dõi rủi ro và phát cảnh báo đến người dân kịp thời
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-ink-muted">
            Dữ liệu dự báo, bản đồ thiên tai, tình trạng tiếp cận cảnh báo và các công cụ điều hành được tổng hợp trong một màn hình.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-primary text-primary-ink">
              <IconBuildingCommunity className="h-7 w-7" stroke={1.8} />
            </div>
            <h2 className="font-display mt-4 text-2xl font-bold text-ink">Đăng nhập cán bộ xã</h2>
            <p className="mt-1 text-sm text-ink-muted">Sử dụng tài khoản được cấp hoặc đăng ký tài khoản demo.</p>
          </div>
          <div className="mt-6">
            <PhoneAuthForm
              communes={communes}
              defaultCommuneId={defaultCommuneId}
              communeLabel="Xã bạn quản lý"
              onLogin={loginOfficial}
              onRegister={registerOfficial}
              onDone={setOfficial}
            />
          </div>
>>>>>>> Stashed changes
        </div>
        <h1 className="mt-3 font-display text-xl font-bold">Cán bộ xã</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Đăng nhập bằng số điện thoại để xem bản đồ rủi ro, bản tin AI và tình trạng người dân đã xem cảnh báo.
        </p>
      </div>
<<<<<<< Updated upstream
      <div className="card p-5">
        <PhoneAuthForm
          communes={communes}
          defaultCommuneId={defaultCommuneId}
          communeLabel="Xã bạn quản lý"
          onLogin={loginOfficial}
          onRegister={registerOfficial}
          onDone={setOfficial}
        />
=======
    </main>
  );
}

function WeatherStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-l border-border px-4 first:border-l-0 first:pl-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-ink-muted">{label}</p>
        <p className="font-data truncate text-[15px] font-bold text-ink">{value}</p>
        {detail && <p className="truncate text-[10px] text-ink-muted">{detail}</p>}
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

<<<<<<< Updated upstream
=======
function WeatherCard({ forecast, day, isToday }: { forecast: CommuneForecast; day: DayForecast | undefined; isToday: boolean }) {
  const current = forecast.current;
  if (isToday) {
    return (
      <article className="card flex min-h-[390px] flex-col p-6">
        <div>
          <p className="text-xs font-medium text-ink-muted">Thời tiết hiện tại</p>
          <h2 className="font-display mt-1 text-[17px] font-bold text-ink">{forecast.commune.name}, Điện Biên</h2>
        </div>

        <div className="mt-7 flex items-center gap-5">
          <WeatherIcon iconKey={current?.icon_key ?? null} className="h-16 w-16 text-primary" />
          <div>
            <p className="font-data text-[54px] font-bold leading-none tracking-[-0.03em] text-ink">
              {numberOrDash(current?.temperature_c ?? null, "°C")}
            </p>
            <p className="mt-2 text-sm font-medium text-ink">{current?.condition ?? "Chưa có dữ liệu"}</p>
            <p className="mt-1 text-sm text-ink-muted">Cảm giác như {numberOrDash(current?.apparent_temperature_c ?? null, "°C")}</p>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-y-4 rounded-md border border-border bg-surface-muted px-4 py-3.5 sm:grid-cols-4">
          <WeatherStat
            icon={<IconDroplet className="h-5 w-5" stroke={1.8} />}
            label="Độ ẩm"
            value={numberOrDash(current?.humidity_percent ?? null, "%")}
          />
          <WeatherStat
            icon={<IconWind className="h-5 w-5" stroke={1.8} />}
            label="Gió"
            value={current?.wind_speed_kmh == null ? "—" : `${Math.round(current.wind_speed_kmh)} km/h`}
            detail={windDirection(current?.wind_direction_deg ?? null)}
          />
          <WeatherStat
            icon={<IconEye className="h-5 w-5" stroke={1.8} />}
            label="Tầm nhìn"
            value={current?.visibility_m == null ? "—" : `${(current.visibility_m / 1000).toFixed(1)} km`}
          />
          <WeatherStat
            icon={<IconCloud className="h-5 w-5" stroke={1.8} />}
            label="Mây che phủ"
            value={numberOrDash(current?.cloud_cover_percent ?? null, "%")}
          />
        </div>
      </article>
    );
  }

  return (
    <article className="card flex min-h-[390px] flex-col p-6">
      <div>
        <p className="text-xs font-medium text-ink-muted">Dự báo ngày {day ? formatShortDate(day.date) : "—"}</p>
        <h2 className="font-display mt-1 text-[17px] font-bold text-ink">{forecast.commune.name}, Điện Biên</h2>
      </div>

      <div className="mt-7 flex items-center gap-5">
        <WeatherIcon iconKey={day?.icon_key ?? null} className="h-16 w-16 text-primary" />
        <div>
          <p className="font-data text-[40px] font-bold leading-none tracking-[-0.03em] text-ink">
            {numberOrDash(day?.temp_min_c ?? null)}–{numberOrDash(day?.temp_max_c ?? null, "°C")}
          </p>
          <p className="mt-2 text-sm font-medium text-ink">{day?.condition ?? "Chưa có dữ liệu"}</p>
          <p className="mt-1 text-sm text-ink-muted">Chưa có dữ liệu &quot;hiện tại&quot; cho ngày tương lai — đây là dự báo mô hình.</p>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-y-4 rounded-md border border-border bg-surface-muted px-4 py-3.5 sm:grid-cols-4">
        <WeatherStat
          icon={<IconDroplet className="h-5 w-5" stroke={1.8} />}
          label="Khả năng mưa"
          value={numberOrDash(day?.rain_probability_max_percent ?? null, "%")}
        />
        <WeatherStat
          icon={<IconCloudRain className="h-5 w-5" stroke={1.8} />}
          label="Lượng mưa"
          value={day?.rain_sum_mm == null ? "—" : `${day.rain_sum_mm.toFixed(1)} mm`}
        />
        <WeatherStat
          icon={<IconWind className="h-5 w-5" stroke={1.8} />}
          label="Gió giật"
          value={day?.wind_gust_max_kmh == null ? "—" : `${Math.round(day.wind_gust_max_kmh)} km/h`}
        />
        <WeatherStat
          icon={<IconCloud className="h-5 w-5" stroke={1.8} />}
          label="Mức rủi ro"
          value={day?.risk.label ?? "—"}
        />
      </div>
    </article>
  );
}

type AlertSummary = {
  type: "landslide" | "flash_flood" | "rain" | "normal";
  title: string;
  description: string;
  severity: RiskInfo;
};

function alertSummary(day: DayForecast | undefined, fallbackRisk: RiskInfo): AlertSummary {
  if (!day) {
    return { type: "normal", title: "Chưa có dữ liệu cảnh báo", description: "Vui lòng cập nhật lại dữ liệu.", severity: fallbackRisk };
  }

  const candidates: AlertSummary[] = [];
  if (day.landslide) {
    candidates.push({
      type: "landslide",
      title: "Theo dõi nguy cơ sạt lở đất",
      description: "Tránh khu vực sườn dốc, taluy và theo dõi thông tin từ chính quyền địa phương.",
      severity: day.landslide.severity,
    });
  }
  if (day.flash_flood) {
    candidates.push({
      type: "flash_flood",
      title: "Theo dõi nguy cơ lũ quét",
      description: "Không đi qua ngầm, suối khi nước dâng; chủ động tránh xa vùng trũng thấp.",
      severity: day.flash_flood.severity,
    });
  }
  day.hazards.forEach((hazard) => {
    candidates.push({
      type: "rain",
      title: hazard.title,
      description: "Theo dõi diễn biến thời tiết và thực hiện hướng dẫn an toàn của cán bộ xã.",
      severity: hazard.severity,
    });
  });
  if (candidates.length) return candidates.sort((a, b) => b.severity.level - a.severity.level)[0];

  return {
    type: day.rain_sum_mm && day.rain_sum_mm >= 10 ? "rain" : "normal",
    title: day.rain_sum_mm && day.rain_sum_mm >= 10 ? "Theo dõi mưa tại địa phương" : "Chưa có cảnh báo nguy hiểm",
    description: `${day.condition ?? "Thời tiết ổn định"}${day.rain_sum_mm != null ? `, lượng mưa dự báo ${day.rain_sum_mm.toFixed(1)} mm.` : "."}`,
    severity: day.risk,
  };
}

function AlertIcon({ type, className }: { type: AlertSummary["type"]; className?: string }) {
  if (type === "landslide") return <LandslideIcon className={className} />;
  if (type === "flash_flood") return <FlashFloodIcon className={className} />;
  if (type === "rain") return <IconCloudRain className={className} stroke={1.8} />;
  return <IconBellRinging className={className} stroke={1.8} />;
}

function RiskMini({
  label,
  severity,
  icon,
}: {
  label: string;
  severity: RiskInfo;
  icon: React.ReactNode;
}) {
  const textClass = RISK_TEXT_CLASS[severity.level] ?? RISK_TEXT_CLASS[0];
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${textClass}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className={`mt-1 text-[10px] font-semibold ${textClass}`}>{severity.label}</p>
      </div>
    </div>
  );
}

function AlertCard({ day, fallbackRisk }: { day: DayForecast | undefined; fallbackRisk: RiskInfo }) {
  const summary = alertSummary(day, fallbackRisk);
  const safeRisk: RiskInfo = { level: 0, label: "Thấp", color: "#2e7d32", icon: "" };
  const rainRisk = day?.hazards.find((hazard) => hazard.type.includes("rain"))?.severity ?? day?.risk ?? safeRisk;
  const floodRisk = day?.flash_flood?.severity ?? safeRisk;
  const landslideRisk = day?.landslide?.severity ?? safeRisk;
  const summaryTextClass = RISK_TEXT_CLASS[summary.severity.level] ?? RISK_TEXT_CLASS[0];

  return (
    <section id="canh-bao" className="notice flex min-h-[188px] flex-col p-5" style={{ borderLeftColor: `var(--color-risk-${summary.severity.level})` }}>
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <IconBellRinging className={`h-5 w-5 ${summaryTextClass}`} stroke={1.8} />
          Cảnh báo thiên tai — {day ? `ngày ${formatShortDate(day.date)}` : "chưa rõ ngày"}
        </h2>
      </div>

      <div className="mt-4 grid flex-1 gap-5 md:grid-cols-[1.35fr_1fr] md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${summaryTextClass}`}>
              <AlertIcon type={summary.type} className="h-6 w-6" />
            </span>
            <div>
              <h3 className={`text-xl font-bold ${summaryTextClass}`}>{summary.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{summary.description}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-ink-muted">
            {day ? `Dữ liệu ngày ${formatShortDate(day.date)}` : "Chưa có thời gian cập nhật"} · Nguồn: Open-Meteo & NCHMF
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <RiskMini label="Mưa lớn" severity={rainRisk} icon={<IconCloudRain className="h-6 w-6" stroke={1.7} />} />
          <RiskMini label="Lũ quét" severity={floodRisk} icon={<FlashFloodIcon className="h-6 w-6" />} />
          <RiskMini label="Sạt lở đất" severity={landslideRisk} icon={<LandslideIcon className="h-6 w-6" />} />
        </div>
      </div>
    </section>
  );
}

function QuickAction({
  icon,
  title,
  description,
  tone,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "orange" | "blue" | "green";
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClass = {
    orange: "border-risk-2/25 bg-risk-2/8 text-risk-2",
    blue: "border-primary/25 bg-primary/8 text-primary",
    green: "border-risk-0/25 bg-risk-0/8 text-risk-0",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[92px] flex-1 items-start gap-3 rounded-md border p-3 text-left transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 ${toneClass}`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">{icon}</span>
      <span>
        <span className="block text-xs font-bold">{title}</span>
        <span className="mt-1 block text-[10px] leading-relaxed text-ink-muted">{description}</span>
      </span>
    </button>
  );
}

function ForecastCards({
  days,
  selectedDay,
  onSelect,
}: {
  days: DayForecast[];
  selectedDay: number;
  onSelect: (day: number) => void;
}) {
  return (
    <article id="du-bao" className="card min-h-[218px] p-5">
      <h2 className="font-display text-[15px] font-bold text-ink">Dự báo 5 ngày tới</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {days.map((day) => {
          const selected = selectedDay === day.day_index;
          return (
            <button
              key={day.day_index}
              type="button"
              onClick={() => onSelect(day.day_index)}
              aria-pressed={selected}
              className={selected
                ? "rounded-md border border-primary bg-primary/8 px-2 py-2.5 text-center"
                : "rounded-md border border-border bg-surface px-2 py-2.5 text-center transition hover:bg-surface-muted"
              }
            >
              <p className="truncate text-[11px] font-bold text-ink">{dayName(day)}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">{formatShortDate(day.date)}</p>
              <WeatherIcon iconKey={day.icon_key} className="mx-auto my-2 h-8 w-8 text-primary" />
              <p className="font-data text-xs font-bold text-ink">
                {numberOrDash(day.temp_max_c, "°")} <span className="font-medium text-ink-muted">/ {numberOrDash(day.temp_min_c, "°")}</span>
              </p>
              <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-primary">
                <IconDroplet className="h-3 w-3" /> {numberOrDash(day.rain_probability_max_percent, "%")}
              </p>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function RainfallChart({ days }: { days: DayForecast[] }) {
  const max = Math.max(1, ...days.map((day) => day.rain_sum_mm ?? 0));
  return (
    <article className="card min-h-[218px] p-5">
      <h2 className="font-display text-[15px] font-bold text-ink">Lượng mưa 5 ngày tới (mm)</h2>
      <div className="mt-4 flex h-[112px] items-end gap-5 border-b border-border px-3">
        {days.map((day) => {
          const value = day.rain_sum_mm ?? 0;
          const height = Math.max(8, (value / max) * 82);
          return (
            <div key={day.day_index} className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 font-data text-[10px] font-bold text-ink">{Math.round(value)}</span>
              <span className="block w-full max-w-8 rounded-t-sm bg-primary/70 transition group-hover:bg-primary" style={{ height }} />
              <span className="mt-1.5 whitespace-nowrap text-[9px] text-ink-muted">{day.day_index === 0 ? "Hôm nay" : formatShortDate(day.date)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

>>>>>>> Stashed changes
function DashboardBody({
  communes,
  notifications,
  notifyError,
  home,
  focusCommuneId,
  defaultCommuneId,
}: {
  communes: Commune[];
  notifications: NotificationItem[];
  notifyError: boolean;
  home: { commune: Commune; forecast: CommuneForecast } | null;
  focusCommuneId?: string;
  defaultCommuneId: string;
}) {
  const { official } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (official && !searchParams.get("commune") && official.commune_id !== defaultCommuneId) {
      router.replace(`/quan-ly?commune=${official.commune_id}#top`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [official]);

  return (
<<<<<<< Updated upstream
    <>
      <section
        id="top"
        className="relative min-h-[calc(100dvh-5rem)] scroll-mt-20 overflow-hidden lg:min-h-[calc(100dvh-4.5rem)] lg:scroll-mt-24"
      >
        <HeroVideo />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1730]/95 via-[#16244a]/55 to-[#16244a]/20" />
        <div className="bg-contour-light absolute inset-0 opacity-30" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 hidden h-36 bg-gradient-to-b from-transparent to-bg lg:block" aria-hidden />

        <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col justify-end px-5 pb-24 pt-24 lg:min-h-[calc(100dvh-4.5rem)] lg:px-8 lg:pb-32">
          <div className="mx-auto w-full max-w-5xl">
            <p className="font-display text-3xl font-extrabold leading-tight text-white lg:max-w-xl lg:text-4xl">
              Bảng điều khiển cán bộ xã
            </p>
            <p className="mt-2 max-w-md text-sm text-white/75 lg:text-base">
              Xin chào {official?.display_name}. Dự báo, cảnh báo và tình trạng người dân đã xem, theo thời gian
              thực.
            </p>
          </div>
=======
    <main id="top" className="min-h-screen scroll-mt-24 bg-bg">
      {toast && (
        <div role="status" className="card card-raised fixed right-5 top-24 z-[100] max-w-sm px-4 py-3 text-sm font-medium text-ink">
          {toast}
>>>>>>> Stashed changes
        </div>
      </section>

      {home && (
        <>
          <div className="relative z-10 mx-auto -mt-16 w-full max-w-5xl px-5 lg:-mt-20 lg:px-8">
            <div className="max-w-sm">
              <RiskHeroCard commune={home.commune} today={home.forecast.forecast[0]} current={home.forecast.current} />
            </div>
          </div>

          <Section id="du-bao">
            <Suspense fallback={null}>
              <ForecastSection communes={communes} defaultCommuneId={focusCommuneId ?? defaultCommuneId} />
            </Suspense>
          </Section>

          <Section id="nguoi-dan-da-xem" className="bg-surface-muted/60">
            <Suspense fallback={null}>
              <ResidentViewMapSection communes={communes} defaultCommuneId={focusCommuneId ?? defaultCommuneId} />
            </Suspense>
          </Section>

          <Section id="thong-bao">
            <NotificationsSection items={notifications} loadError={notifyError} />
          </Section>

          <Section id="chatbot" className="bg-surface-muted/60">
            <ChatSection communes={communes} defaultCommuneId={defaultCommuneId} />
          </Section>
        </>
      )}
<<<<<<< Updated upstream
    </>
=======

      <div className="mx-auto max-w-[1920px] px-4 pb-8 pt-5 sm:px-6 2xl:px-7">
        <div className="card flex flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <label className="relative min-w-0">
              <span className="sr-only">Chọn xã để xem thời tiết</span>
              <IconMapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" stroke={1.8} />
              <select
                value={home.commune.id}
                onChange={(event) => onCommuneChange(event.target.value)}
                className="h-10 max-w-[330px] appearance-none rounded-md border border-border bg-surface-muted pl-9 pr-10 text-sm font-semibold text-ink outline-none transition focus:border-primary"
              >
                {communes.map((commune) => (
                  <option key={commune.id} value={commune.id}>{commune.name}, Điện Biên</option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" stroke={1.8} />
            </label>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="hidden text-xs font-medium text-ink-muted md:inline">Chế độ xem</span>
            <div className="inline-flex rounded-md bg-surface-muted p-1">
              <button type="button" onClick={() => router.push("/")} className="flex h-9 items-center gap-2 rounded-sm px-3 text-xs font-medium text-ink-muted transition hover:bg-surface">
                <IconUsers className="h-4 w-4" /> Người dân
              </button>
              <button type="button" aria-pressed="true" className="flex h-9 items-center gap-2 rounded-sm bg-primary px-3 text-xs font-semibold text-primary-ink">
                <IconBuildingCommunity className="h-4 w-4" /> Cán bộ xã
              </button>
            </div>
          </div>

          <p className="flex items-center justify-end gap-2 text-[11px] text-ink-muted sm:min-w-[225px]">
            <IconRefresh className="h-4 w-4" stroke={1.8} /> {updateLabel}
          </p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.02fr]">
          <WeatherCard forecast={home.forecast} day={selectedForecast} isToday={selectedDay === 0} />
          <OfficerDashboardMap
            focusCommuneId={home.commune.id}
            focusCommuneName={home.commune.name}
            selectedDay={selectedDay}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[2.1fr_1fr]">
          <AlertCard day={selectedForecast} fallbackRisk={home.forecast.overall_risk} />
          <aside className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <IconAlertTriangle className="h-5 w-5 text-primary" stroke={1.8} /> Thao tác nhanh
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <QuickAction
                icon={<IconSpeakerphone className="h-5 w-5" stroke={1.8} />}
                title={!isAssignedCommune ? "Chỉ xem thời tiết" : sending ? "Đang phát..." : "Phát cảnh báo"}
                description={isAssignedCommune ? "Gửi cảnh báo đến người dân trong xã" : "Chỉ phát cảnh báo tại xã bạn quản lý"}
                tone="orange"
                onClick={handleSendAlert}
                disabled={sending || !isAssignedCommune}
              />
              <QuickAction
                icon={<IconFileReport className="h-5 w-5" stroke={1.8} />}
                title="Xuất báo cáo"
                description="Tải số liệu thời tiết và rủi ro"
                tone="green"
                onClick={exportReport}
              />
            </div>
          </aside>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_.88fr]">
          <ForecastCards
            days={home.forecast.forecast.slice(0, 5)}
            selectedDay={selectedDay}
            onSelect={(day) => setDaySelection({ communeId: home.commune.id, day })}
          />
          <RainfallChart days={home.forecast.forecast.slice(0, 5)} />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-4 py-2.5 text-[10px] leading-relaxed text-ink-muted">
          <IconDownload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Dữ liệu thời tiết được cập nhật từ Open-Meteo và cảnh báo NCHMF. Các chỉ số dự báo hỗ trợ cán bộ chủ động phòng tránh thiên tai, không thay thế bản tin chuyên môn chính thức.
        </div>
      </div>
      <FloatingChatWidget communeId={home.commune.id} />
    </main>
>>>>>>> Stashed changes
  );
}

export default function OfficialDashboard(props: {
  communes: Commune[];
  notifications: NotificationItem[];
  notifyError: boolean;
  home: { commune: Commune; forecast: CommuneForecast } | null;
  focusCommuneId?: string;
  defaultCommuneId: string;
}) {
  const { official, loading } = useRole();

  if (loading) {
<<<<<<< Updated upstream
    return <div className="skeleton mx-5 mt-8 h-64 rounded-lg" />;
=======
    return <div className="skeleton mx-auto mt-8 h-[620px] max-w-[1500px] rounded-lg" />;
  }
  if (!official) return <OfficialGate communes={communes} />;

  const assignedCommune = communes.find((commune) => commune.id === official.commune_id);
  const viewedCommune = communes.find((commune) => commune.id === selectedCommuneId);
  if (!assignedCommune) {
    return <div className="notice mx-auto mt-8 max-w-xl p-5 text-sm text-ink" style={{ borderLeftColor: "var(--color-risk-2)" }}>Không tìm thấy xã được phân công cho tài khoản này.</div>;
  }
  if (!viewedCommune) {
    return <div className="notice mx-auto mt-8 max-w-xl p-5 text-sm text-ink" style={{ borderLeftColor: "var(--color-risk-2)" }}>Không tìm thấy địa phương cần xem.</div>;
  }
  if (forecastErrorFor === `${official.id}:${selectedCommuneId}`) {
    return (
      <div className="notice mx-auto mt-8 max-w-xl p-5 text-sm text-ink" style={{ borderLeftColor: "var(--color-risk-2)" }}>
        <p>Chưa tải được dữ liệu của {viewedCommune.name}. Vui lòng thử lại sau.</p>
        {selectedCommuneId !== official.commune_id && (
          <button
            type="button"
            onClick={() => setCommuneSelection({ officialId: official.id, communeId: official.commune_id })}
            className="mt-3 rounded-md bg-surface px-3 py-2 text-xs font-bold text-ink border border-border"
          >
            Xem lại xã của tôi
          </button>
        )}
      </div>
    );
  }
  if (!forecastState || forecastState.officialId !== official.id || forecastState.communeId !== selectedCommuneId) {
    return <div className="skeleton mx-auto mt-8 h-[620px] max-w-[1500px] rounded-lg" />;
>>>>>>> Stashed changes
  }

  if (!official) {
    return <OfficialGate communes={props.communes} />;
  }

  return <DashboardBody {...props} />;
}
