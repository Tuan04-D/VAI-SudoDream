"use client";

import { Suspense, useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconBellRinging,
  IconBuildingCommunity,
  IconChevronDown,
  IconCloud,
  IconCloudRain,
  IconDownload,
  IconDroplet,
  IconEye,
  IconFileReport,
  IconMapPin,
  IconRefresh,
  IconSpeakerphone,
  IconWind,
} from "@tabler/icons-react";
import PhoneAuthForm from "@/components/auth/PhoneAuthForm";
import NotificationsSection from "@/components/notifications/NotificationsSection";
import ResidentViewMapSection from "@/components/officer/ResidentViewMapSection";
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";
import WeatherIcon, { FlashFloodIcon, LandslideIcon } from "@/components/ui/WeatherIcon";
import { useRole } from "@/lib/RoleProvider";
import { RISK_TEXT_CLASS } from "@/lib/risk";
import { fetchForecast, loginOfficial, registerOfficial, sendOfficerAlert } from "@/lib/api";
import type { Commune, CommuneForecast, DayForecast, NotificationItem, RiskInfo } from "@/lib/types";
import OfficerDashboardMap from "./OfficerDashboardMap";

function numberOrDash(value: number | null, suffix = "") {
  return value == null ? "—" : `${Math.round(value)}${suffix}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${value}T00:00:00`)
  );
}

function dayName(day: DayForecast) {
  if (day.day_index === 0) return "Hôm nay";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" })
    .format(new Date(`${day.date}T00:00:00`))
    .replace(/^./, (letter) => letter.toLocaleUpperCase("vi"));
}

function OfficialGate({ communes }: { communes: Commune[] }) {
  const { setOfficial } = useRole();
  const defaultCommuneId = communes[0]?.id ?? "";

  return (
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
            Dự báo, bản đồ thiên tai và tình trạng tiếp cận cảnh báo được tổng hợp trong một màn hình điều hành.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-primary text-primary-ink">
              <IconBuildingCommunity className="h-7 w-7" stroke={1.8} />
            </div>
            <h2 className="font-display mt-4 text-2xl font-bold text-ink">Đăng nhập cán bộ xã</h2>
            <p className="mt-1 text-sm text-ink-muted">Sử dụng tài khoản do quản trị viên hệ thống cấp.</p>
          </div>
          <div className="mt-6">
            <PhoneAuthForm
              communes={communes}
              defaultCommuneId={defaultCommuneId}
              communeLabel="Xã bạn quản lý"
              onLogin={loginOfficial}
              onRegister={registerOfficial}
              onDone={setOfficial}
              allowRegister={false}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function WeatherStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-l border-border px-4 first:border-l-0 first:pl-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-ink-muted">{label}</p>
        <p className="font-data truncate text-[15px] font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

type WeatherSceneKind = "clear" | "cloudy" | "fog" | "rain" | "storm" | "snow";

function sceneKind(iconKey: string | null): WeatherSceneKind {
  if (iconKey === "clear") return "clear";
  if (iconKey === "fog") return "fog";
  if (iconKey === "rain" || iconKey === "heavy_rain") return "rain";
  if (iconKey === "thunderstorm" || iconKey === "hail") return "storm";
  if (iconKey === "snow") return "snow";
  return "cloudy";
}

function WeatherScene({ iconKey }: { iconKey: string | null }) {
  const kind = sceneKind(iconKey);
  const hasClouds = kind !== "clear";
  const hasRain = kind === "rain" || kind === "storm";

  return (
    <div className={`weather-scene weather-scene-${kind} absolute inset-0 overflow-hidden`} aria-hidden>
      {kind === "clear" && <span className="weather-sun" />}
      {hasClouds && (
        <>
          <span className="weather-cloud weather-cloud-one" />
          <span className="weather-cloud weather-cloud-two" />
          <span className="weather-cloud weather-cloud-three" />
        </>
      )}
      {kind === "fog" && (
        <div className="weather-fog-lines">
          <span /><span /><span /><span />
        </div>
      )}
      {hasRain && (
        <div className="weather-rain-lines">
          {Array.from({ length: 22 }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 19) % 104}%`,
                animationDelay: `-${(index % 7) * 0.16}s`,
                animationDuration: `${0.72 + (index % 4) * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}
      {kind === "snow" && (
        <div className="weather-snow-dots">
          {Array.from({ length: 18 }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 23) % 100}%`,
                animationDelay: `-${(index % 6) * 0.38}s`,
              }}
            />
          ))}
        </div>
      )}
      {kind === "storm" && <span className="weather-lightning" />}
      <svg viewBox="0 0 720 230" className="absolute inset-x-0 bottom-0 h-[58%] w-full text-white/20" fill="currentColor">
        <path d="M0 230 92 112l50 55 88-122 78 117 61-78 72 82 62-51 53 58 63-91 101 148Z" />
        <path d="m0 230 112-68 57 35 71-55 82 57 75-43 71 48 63-30 67 56Z" opacity=".45" />
      </svg>
      <div className="bg-contour-light absolute inset-0 opacity-25" />
    </div>
  );
}

function WeatherCard({
  forecast,
  day,
  isToday,
  communeName,
  loading,
}: {
  forecast: CommuneForecast;
  day?: DayForecast;
  isToday: boolean;
  communeName: string;
  loading: boolean;
}) {
  const current = forecast.current;
  const iconKey = isToday ? current?.icon_key ?? null : day?.icon_key ?? null;
  const temperature = isToday
    ? numberOrDash(current?.temperature_c ?? null, "°C")
    : `${numberOrDash(day?.temp_min_c ?? null)}–${numberOrDash(day?.temp_max_c ?? null, "°C")}`;

  return (
    <article className="card relative flex min-h-[390px] flex-col overflow-hidden bg-primary-dark p-6 text-white">
      <WeatherScene iconKey={iconKey} />
      <div className="absolute inset-0 bg-gradient-to-br from-ink/78 via-primary-dark/62 to-primary/20" aria-hidden />

      <div className="relative flex h-full flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-white/70">{isToday ? "Thời tiết hiện tại" : `Dự báo ngày ${day ? formatShortDate(day.date) : "—"}`}</p>
            <h2 className="font-display mt-1 text-[17px] font-bold text-white">{communeName}, Điện Biên</h2>
          </div>
          <span className="rounded-sm bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80 backdrop-blur-sm">
            Minh họa theo thời tiết
          </span>
        </div>
        <div className="mt-7 flex items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/12 backdrop-blur-sm">
            <WeatherIcon iconKey={iconKey} className="h-14 w-14 text-white" />
          </span>
          <div>
            <p className="font-data text-[48px] font-bold leading-none tracking-[-0.03em] text-white">{temperature}</p>
            <p className="mt-2 text-sm font-bold text-white">{isToday ? current?.condition : day?.condition}</p>
            <p className="mt-1 text-sm text-white/70">
              {isToday
                ? `Cảm giác như ${numberOrDash(current?.apparent_temperature_c ?? null, "°C")}`
                : "Dữ liệu dự báo mô hình cho ngày đã chọn"
              }
            </p>
          </div>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-y-4 rounded-md bg-white/92 px-4 py-3.5 shadow-lg backdrop-blur-md sm:grid-cols-4">
          <WeatherStat icon={<IconDroplet />} label={isToday ? "Độ ẩm" : "Khả năng mưa"} value={numberOrDash(isToday ? current?.humidity_percent ?? null : day?.rain_probability_max_percent ?? null, "%")} />
          <WeatherStat icon={<IconWind />} label={isToday ? "Gió" : "Gió giật"} value={numberOrDash(isToday ? current?.wind_speed_kmh ?? null : day?.wind_gust_max_kmh ?? null, " km/h")} />
          <WeatherStat icon={<IconEye />} label="Tầm nhìn" value={isToday && current?.visibility_m != null ? `${(current.visibility_m / 1000).toFixed(1)} km` : "—"} />
          <WeatherStat icon={<IconCloud />} label={isToday ? "Mây che phủ" : "Lượng mưa"} value={isToday ? numberOrDash(current?.cloud_cover_percent ?? null, "%") : day?.rain_sum_mm == null ? "—" : `${day.rain_sum_mm.toFixed(1)} mm`} />
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary-dark/55 backdrop-blur-[2px]" aria-live="polite">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-primary-dark shadow-xl">
            <IconRefresh className="h-4 w-4 animate-spin" /> Đang cập nhật dữ liệu xã…
          </span>
        </div>
      )}
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
  if (!day) return { type: "normal", title: "Chưa có dữ liệu cảnh báo", description: "Vui lòng cập nhật lại dữ liệu.", severity: fallbackRisk };
  if (day.flash_flood) return { type: "flash_flood", title: "Theo dõi nguy cơ lũ quét", description: "Không đi qua ngầm, suối khi nước dâng; tránh xa vùng trũng thấp.", severity: day.flash_flood.severity };
  if (day.landslide) return { type: "landslide", title: "Theo dõi nguy cơ sạt lở đất", description: "Tránh khu vực sườn dốc, taluy và theo dõi hướng dẫn địa phương.", severity: day.landslide.severity };
  const hazard = [...day.hazards].sort((a, b) => b.severity.level - a.severity.level)[0];
  if (hazard) return { type: "rain", title: hazard.title, description: "Theo dõi diễn biến thời tiết và chủ động phương án an toàn.", severity: hazard.severity };
  return { type: day.rain_sum_mm && day.rain_sum_mm >= 10 ? "rain" : "normal", title: day.rain_sum_mm && day.rain_sum_mm >= 10 ? "Theo dõi mưa tại địa phương" : "Chưa có cảnh báo nguy hiểm", description: day.condition ?? "Thời tiết tương đối ổn định.", severity: day.risk };
}

function AlertGraphic({ type }: { type: AlertSummary["type"] }) {
  if (type === "landslide") return <LandslideIcon className="h-7 w-7" />;
  if (type === "flash_flood") return <FlashFloodIcon className="h-7 w-7" />;
  if (type === "rain") return <IconCloudRain className="h-7 w-7" stroke={1.8} />;
  return <IconBellRinging className="h-7 w-7" stroke={1.8} />;
}

function AlertCard({ day, fallbackRisk }: { day?: DayForecast; fallbackRisk: RiskInfo }) {
  const summary = alertSummary(day, fallbackRisk);
  const textClass = RISK_TEXT_CLASS[summary.severity.level] ?? RISK_TEXT_CLASS[0];
  return (
    <section id="canh-bao" className="notice flex min-h-[188px] flex-col p-5" style={{ borderLeftColor: `var(--color-risk-${summary.severity.level})` }}>
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
        <IconAlertTriangle className={`h-5 w-5 ${textClass}`} stroke={1.8} />
        Cảnh báo thiên tai {day ? `— ngày ${formatShortDate(day.date)}` : ""}
      </h2>
      <div className="mt-5 flex flex-1 items-center gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center ${textClass}`}><AlertGraphic type={summary.type} /></span>
        <div>
          <h3 className={`text-xl font-bold ${textClass}`}>{summary.title}</h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{summary.description}</p>
          <p className="mt-2 text-[10px] text-ink-muted">Nguồn dữ liệu: Open-Meteo và cảnh báo NCHMF</p>
        </div>
      </div>
    </section>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[92px] flex-1 items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-left text-primary transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">{icon}</span>
      <span>
        <span className="block text-xs font-bold">{title}</span>
        <span className="mt-1 block text-[10px] leading-relaxed text-ink-muted">{description}</span>
      </span>
    </button>
  );
}

function ForecastCards({ days, selectedDay, onSelect }: { days: DayForecast[]; selectedDay: number; onSelect: (day: number) => void }) {
  return (
    <article id="du-bao" className="card min-h-[218px] p-5">
      <h2 className="font-display text-[15px] font-bold text-ink">Dự báo 5 ngày tới</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {days.map((day) => {
          const selected = selectedDay === day.day_index;
          return (
            <button key={day.day_index} type="button" onClick={() => onSelect(day.day_index)} aria-pressed={selected} className={selected ? "rounded-md border border-primary bg-primary/8 px-2 py-2.5 text-center" : "rounded-md border border-border bg-surface px-2 py-2.5 text-center transition hover:bg-surface-muted"}>
              <p className="truncate text-[11px] font-bold text-ink">{dayName(day)}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">{formatShortDate(day.date)}</p>
              <WeatherIcon iconKey={day.icon_key} className="mx-auto my-2 h-8 w-8 text-primary" />
              <p className="font-data text-xs font-bold text-ink">{numberOrDash(day.temp_max_c, "°")} <span className="font-medium text-ink-muted">/ {numberOrDash(day.temp_min_c, "°")}</span></p>
              <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-primary"><IconDroplet className="h-3 w-3" /> {numberOrDash(day.rain_probability_max_percent, "%")}</p>
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
          return (
            <div key={day.day_index} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 font-data text-[10px] font-bold text-ink">{Math.round(value)}</span>
              <span className="block w-full max-w-8 rounded-t-sm bg-primary/70" style={{ height: Math.max(8, (value / max) * 82) }} />
              <span className="mt-1.5 whitespace-nowrap text-[9px] text-ink-muted">{day.day_index === 0 ? "Hôm nay" : formatShortDate(day.date)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

const dashboardForecastCache = new Map<string, CommuneForecast>();

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
  const initialCommuneId = focusCommuneId ?? official?.commune_id ?? defaultCommuneId;
  const initialForecast = home?.commune.id === initialCommuneId ? home.forecast : null;
  if (home) dashboardForecastCache.set(home.commune.id, home.forecast);
  const [communeId, setCommuneId] = useState(initialCommuneId);
  const [forecast, setForecast] = useState<CommuneForecast | null>(
    initialForecast ?? dashboardForecastCache.get(initialCommuneId) ?? home?.forecast ?? null
  );
  const [forecastLoading, setForecastLoading] = useState(!dashboardForecastCache.has(initialCommuneId));
  const [selectedDay, setSelectedDay] = useState(0);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const cached = dashboardForecastCache.get(communeId);
    if (cached) return;

    let cancelled = false;
    fetchForecast(communeId, 5)
      .then((data) => {
        if (cancelled) return;
        dashboardForecastCache.set(communeId, data);
        setForecast(data);
        setForecastLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setForecastLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [communeId]);

  if (!official) return null;
  const officialId = official.id;
  const selectedCommune = communes.find((item) => item.id === communeId);
  const readyForecast = forecast;
  const forecastIsCurrent = readyForecast?.commune.id === communeId;
  const dataPending = forecastLoading || !forecastIsCurrent;
  const selectedForecast = readyForecast?.forecast.find((day) => day.day_index === selectedDay);
  const isAssignedCommune = official.commune_id === communeId;

  function changeCommune(nextId: string) {
    setCommuneId(nextId);
    setSelectedDay(0);
    const cached = dashboardForecastCache.get(nextId);
    if (cached) {
      setForecast(cached);
      setForecastLoading(false);
    } else {
      setForecastLoading(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("commune", nextId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function handleSendAlert() {
    if (!isAssignedCommune || sending) return;
    setSending(true);
    setToast(null);
    try {
      await sendOfficerAlert(communeId, officialId);
      setToast("Đã tạo cảnh báo web và xếp hàng gửi thông báo cho người dân trong xã.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Chưa phát được cảnh báo.");
    } finally {
      setSending(false);
    }
  }

  function exportReport() {
    if (!readyForecast) return;
    const rows = [
      ["Ngày", "Nhiệt độ thấp", "Nhiệt độ cao", "Mưa (mm)", "Rủi ro"],
      ...readyForecast.forecast.map((day) => [day.date, day.temp_min_c, day.temp_max_c, day.rain_sum_mm, day.risk.label]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value ?? ""}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `du-bao-${communeId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!selectedCommune) return <div className="notice mx-auto mt-8 max-w-xl p-5 text-sm">Không tìm thấy xã cần xem.</div>;
  if (!readyForecast) return <div className="skeleton mx-auto mt-8 h-[620px] max-w-[1500px] rounded-lg" />;

  return (
    <main id="top" className="min-h-screen scroll-mt-24 bg-bg">
      {toast && <div role="status" className="card card-raised fixed right-5 top-24 z-[100] max-w-sm px-4 py-3 text-sm font-medium text-ink">{toast}</div>}
      <div className="mx-auto max-w-[1920px] px-4 pb-8 pt-5 sm:px-6 2xl:px-7">
        <div className="card relative flex flex-col gap-4 overflow-hidden px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative min-w-0">
            <IconMapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" stroke={1.8} />
            <select value={communeId} onChange={(event) => changeCommune(event.target.value)} className="h-10 max-w-[330px] appearance-none rounded-md border border-border bg-surface-muted pl-9 pr-10 text-sm font-semibold text-ink outline-none transition focus:border-primary">
              {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name}, Điện Biên</option>)}
            </select>
            <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" stroke={1.8} />
          </label>
          <p className="flex items-center gap-2 text-xs font-medium text-ink-muted"><IconRefresh className="h-4 w-4" /> Dữ liệu thời tiết trực tiếp</p>
          {dataPending && <span className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-accent" aria-hidden />}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.02fr]">
          <WeatherCard
            forecast={readyForecast}
            day={selectedForecast}
            isToday={selectedDay === 0}
            communeName={selectedCommune.name}
            loading={dataPending}
          />
          <OfficerDashboardMap
            focusCommuneId={communeId}
            focusCommuneName={selectedCommune.name}
            selectedDay={selectedDay}
            focusForecast={forecastIsCurrent ? selectedForecast : undefined}
          />
        </div>

        <div className={`mt-4 grid gap-4 transition-opacity xl:grid-cols-[2.1fr_1fr] ${dataPending ? "pointer-events-none opacity-45" : "opacity-100"}`} aria-busy={dataPending}>
          <AlertCard day={selectedForecast} fallbackRisk={readyForecast.overall_risk} />
          <aside className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><IconAlertTriangle className="h-5 w-5 text-primary" /> Thao tác nhanh</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <QuickAction icon={<IconSpeakerphone className="h-5 w-5" />} title={!isAssignedCommune ? "Chỉ được xem" : sending ? "Đang phát..." : "Phát cảnh báo"} description={isAssignedCommune ? "Tạo cảnh báo cho người dân trong xã" : "Chỉ phát tại xã được phân công"} onClick={() => void handleSendAlert()} disabled={!isAssignedCommune || sending} />
              <QuickAction icon={<IconFileReport className="h-5 w-5" />} title="Xuất báo cáo" description="Tải dữ liệu dự báo dạng CSV" onClick={exportReport} />
            </div>
          </aside>
        </div>

        <div className={`mt-4 grid gap-4 transition-opacity xl:grid-cols-[1.3fr_.88fr] ${dataPending ? "pointer-events-none opacity-45" : "opacity-100"}`}>
          <ForecastCards days={readyForecast.forecast.slice(0, 5)} selectedDay={selectedDay} onSelect={setSelectedDay} />
          <RainfallChart days={readyForecast.forecast.slice(0, 5)} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section id="thong-bao" className="card p-5"><NotificationsSection items={notifications} loadError={notifyError} /></section>
          <section id="nguoi-dan-da-xem" className="card overflow-hidden p-5">
            <Suspense fallback={null}><ResidentViewMapSection key={communeId} communes={communes} defaultCommuneId={communeId} /></Suspense>
          </section>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-4 py-2.5 text-[10px] leading-relaxed text-ink-muted">
          <IconDownload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Dữ liệu Open-Meteo và cảnh báo NCHMF hỗ trợ chủ động phòng tránh, không thay thế bản tin chuyên môn chính thức.
        </div>
      </div>
      <FloatingChatWidget communeId={communeId} />
    </main>
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
  if (loading) return <section suppressHydrationWarning className="skeleton mx-auto mt-8 h-[620px] max-w-[1500px] rounded-lg" aria-label="Đang khôi phục phiên đăng nhập" />;
  if (!official) return <OfficialGate communes={props.communes} />;
  return <DashboardBody {...props} />;
}
