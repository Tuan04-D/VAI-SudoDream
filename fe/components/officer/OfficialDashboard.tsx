"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  IconUsers,
  IconWind,
} from "@tabler/icons-react";
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";
import PhoneAuthForm from "@/components/auth/PhoneAuthForm";
import WeatherIcon, {
  FlashFloodIcon,
  LandslideIcon,
} from "@/components/ui/WeatherIcon";
import { useRole } from "@/lib/RoleProvider";
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
import WeatherLandscape from "./WeatherLandscape";

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

function OfficialGate({ communes }: { communes: Commune[] }) {
  const { setOfficial } = useRole();
  const defaultCommuneId = communes[0]?.id ?? "";
  return (
    <main className="relative min-h-[calc(100dvh-74px)] overflow-hidden bg-[#f5f8fc] px-5 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(79,143,229,.13),transparent_32%),radial-gradient(circle_at_85%_75%,rgba(53,166,110,.10),transparent_30%)]" />
      <div className="relative mx-auto grid min-h-[70vh] max-w-4xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f0ff] px-3 py-1.5 text-xs font-semibold text-[#1769e0]">
            <IconBuildingCommunity className="h-4 w-4" /> Khu vực dành cho cán bộ xã
          </span>
          <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#153363]">
            Theo dõi rủi ro và phát cảnh báo đến người dân kịp thời
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-[#667895]">
            Dữ liệu dự báo, bản đồ thiên tai, tình trạng tiếp cận cảnh báo và các công cụ điều hành được tổng hợp trong một màn hình.
          </p>
        </div>

        <div className="rounded-2xl border border-[#dfe7f2] bg-white p-6 shadow-[0_18px_50px_rgba(41,72,118,.12)] sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1769e0] text-white shadow-lg shadow-blue-200">
              <IconBuildingCommunity className="h-7 w-7" stroke={1.8} />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#173363]">Đăng nhập cán bộ xã</h2>
            <p className="mt-1 text-sm text-[#72809a]">Sử dụng tài khoản được cấp hoặc đăng ký tài khoản demo.</p>
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
        </div>
      </div>
    </main>
  );
}

function WeatherStat({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  accent: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-l border-[#dbe4ed] px-4 first:border-l-0 first:pl-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ color: accent, backgroundColor: `${accent}13` }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-[#73839b]">{label}</p>
        <p className="font-data truncate text-[15px] font-bold text-[#173363]">{value}</p>
        {detail && <p className="truncate text-[10px] text-[#60738f]">{detail}</p>}
      </div>
    </div>
  );
}

function WeatherCard({ forecast }: { forecast: CommuneForecast }) {
  const current = forecast.current;
  return (
    <article className="officer-panel relative min-h-[390px] overflow-hidden">
      <WeatherLandscape />
      <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/58 to-transparent" />
      <div className="relative flex min-h-[390px] flex-col p-6">
        <div>
          <p className="text-xs font-medium text-[#60728e]">Thời tiết hiện tại</p>
          <h2 className="mt-1 text-[17px] font-bold text-[#173363]">{forecast.commune.name}, Điện Biên</h2>
        </div>

        <div className="mt-7 flex items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/65 text-[#568fcb] shadow-[0_8px_25px_rgba(74,127,170,.12)] backdrop-blur-sm">
            <WeatherIcon iconKey={current?.icon_key ?? null} className="h-14 w-14" />
          </span>
          <div>
            <p className="font-data text-[54px] font-bold leading-none tracking-[-0.06em] text-[#15366d]">
              {numberOrDash(current?.temperature_c ?? null, "°C")}
            </p>
            <p className="mt-2 text-sm font-medium text-[#24436d]">{current?.condition ?? "Chưa có dữ liệu"}</p>
            <p className="mt-1 text-sm text-[#62738e]">Cảm giác như {numberOrDash(current?.apparent_temperature_c ?? null, "°C")}</p>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-y-4 rounded-xl border border-white/80 bg-white/88 px-4 py-3.5 shadow-[0_8px_25px_rgba(35,73,109,.08)] backdrop-blur-md sm:grid-cols-4">
          <WeatherStat
            icon={<IconDroplet className="h-5 w-5" stroke={1.8} />}
            label="Độ ẩm"
            value={numberOrDash(current?.humidity_percent ?? null, "%")}
            accent="#2e84ef"
          />
          <WeatherStat
            icon={<IconWind className="h-5 w-5" stroke={1.8} />}
            label="Gió"
            value={current?.wind_speed_kmh == null ? "—" : `${Math.round(current.wind_speed_kmh)} km/h`}
            detail={windDirection(current?.wind_direction_deg ?? null)}
            accent="#2e84ef"
          />
          <WeatherStat
            icon={<IconEye className="h-5 w-5" stroke={1.8} />}
            label="Tầm nhìn"
            value={current?.visibility_m == null ? "—" : `${(current.visibility_m / 1000).toFixed(1)} km`}
            accent="#2da567"
          />
          <WeatherStat
            icon={<IconCloud className="h-5 w-5" stroke={1.8} />}
            label="Mây che phủ"
            value={numberOrDash(current?.cloud_cover_percent ?? null, "%")}
            accent="#d79a28"
          />
        </div>
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

function alertSummary(forecast: CommuneForecast): AlertSummary {
  const today = forecast.forecast[0];
  if (!today) {
    return { type: "normal", title: "Chưa có dữ liệu cảnh báo", description: "Vui lòng cập nhật lại dữ liệu.", severity: forecast.overall_risk };
  }

  const candidates: AlertSummary[] = [];
  if (today.landslide) {
    candidates.push({
      type: "landslide",
      title: "Theo dõi nguy cơ sạt lở đất",
      description: "Tránh khu vực sườn dốc, taluy và theo dõi thông tin từ chính quyền địa phương.",
      severity: today.landslide.severity,
    });
  }
  if (today.flash_flood) {
    candidates.push({
      type: "flash_flood",
      title: "Theo dõi nguy cơ lũ quét",
      description: "Không đi qua ngầm, suối khi nước dâng; chủ động tránh xa vùng trũng thấp.",
      severity: today.flash_flood.severity,
    });
  }
  today.hazards.forEach((hazard) => {
    candidates.push({
      type: "rain",
      title: hazard.title,
      description: "Theo dõi diễn biến thời tiết và thực hiện hướng dẫn an toàn của cán bộ xã.",
      severity: hazard.severity,
    });
  });
  if (candidates.length) return candidates.sort((a, b) => b.severity.level - a.severity.level)[0];

  return {
    type: today.rain_sum_mm && today.rain_sum_mm >= 10 ? "rain" : "normal",
    title: today.rain_sum_mm && today.rain_sum_mm >= 10 ? "Theo dõi mưa tại địa phương" : "Chưa có cảnh báo nguy hiểm",
    description: `${today.condition ?? "Thời tiết ổn định"}${today.rain_sum_mm != null ? `, lượng mưa dự báo ${today.rain_sum_mm.toFixed(1)} mm.` : "."}`,
    severity: today.risk,
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
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${severity.color}12`, color: severity.color }}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-[#334d73]">{label}</p>
        <p className="mt-1 text-[10px] font-semibold" style={{ color: severity.color }}>{severity.label}</p>
      </div>
    </div>
  );
}

function AlertCard({ forecast }: { forecast: CommuneForecast }) {
  const summary = alertSummary(forecast);
  const today = forecast.forecast[0];
  const safeRisk: RiskInfo = { level: 0, label: "Thấp", color: "#2e9d61", icon: "" };
  const rainRisk = today?.hazards.find((hazard) => hazard.type.includes("rain"))?.severity ?? today?.risk ?? safeRisk;
  const floodRisk = today?.flash_flood?.severity ?? safeRisk;
  const landslideRisk = today?.landslide?.severity ?? safeRisk;

  return (
    <section id="canh-bao" className="officer-panel flex min-h-[188px] flex-col border-l-4 p-5" style={{ borderLeftColor: summary.severity.color }}>
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#263f67]">
          <IconBellRinging className="h-5 w-5" style={{ color: summary.severity.color }} stroke={1.8} />
          Cảnh báo thiên tai hiện tại
        </h2>
      </div>

      <div className="mt-4 grid flex-1 gap-5 md:grid-cols-[1.35fr_1fr] md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ color: summary.severity.color, backgroundColor: `${summary.severity.color}12` }}>
              <AlertIcon type={summary.type} className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-xl font-bold" style={{ color: summary.severity.color }}>{summary.title}</h3>
              <p className="mt-1 text-sm text-[#5d708d]">{summary.description}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-[#8390a4]">
            {today ? `Dữ liệu ngày ${formatShortDate(today.date)}` : "Chưa có thời gian cập nhật"} · Nguồn: Open-Meteo & NCHMF
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-[#ebeff5] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
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
  const theme = {
    orange: { border: "#f4decd", background: "#fff6ee", color: "#df5a2f" },
    blue: { border: "#d9e5f8", background: "#f1f6ff", color: "#1769e0" },
    green: { border: "#dcece1", background: "#f1f8f3", color: "#268553" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[92px] flex-1 items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
      style={{ borderColor: theme.border, backgroundColor: theme.background }}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm" style={{ color: theme.color }}>{icon}</span>
      <span>
        <span className="block text-xs font-bold" style={{ color: theme.color }}>{title}</span>
        <span className="mt-1 block text-[10px] leading-relaxed text-[#667895]">{description}</span>
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
    <article id="du-bao" className="officer-panel min-h-[218px] p-5">
      <h2 className="text-[15px] font-bold text-[#173363]">Dự báo 5 ngày tới</h2>
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
                ? "rounded-xl border border-[#4b8cf2] bg-[#f7faff] px-2 py-2.5 text-center shadow-[0_4px_12px_rgba(34,111,230,.08)]"
                : "rounded-xl border border-[#e4e9f1] bg-white px-2 py-2.5 text-center transition hover:border-[#a9c4ed] hover:bg-[#f8fbff]"
              }
            >
              <p className="truncate text-[11px] font-bold text-[#31496e]">{dayName(day)}</p>
              <p className="mt-0.5 text-[10px] text-[#75849b]">{formatShortDate(day.date)}</p>
              <WeatherIcon iconKey={day.icon_key} className="mx-auto my-2 h-8 w-8 text-[#6b9bcc]" />
              <p className="font-data text-xs font-bold text-[#173363]">
                {numberOrDash(day.temp_max_c, "°")} <span className="font-medium text-[#76859b]">/ {numberOrDash(day.temp_min_c, "°")}</span>
              </p>
              <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-[#2a78dc]">
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
    <article className="officer-panel min-h-[218px] p-5">
      <h2 className="text-[15px] font-bold text-[#173363]">Lượng mưa 5 ngày tới (mm)</h2>
      <div className="mt-4 flex h-[112px] items-end gap-5 border-b border-[#e5eaf1] px-3">
        {days.map((day) => {
          const value = day.rain_sum_mm ?? 0;
          const height = Math.max(8, (value / max) * 82);
          return (
            <div key={day.day_index} className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 font-data text-[10px] font-bold text-[#37517b]">{Math.round(value)}</span>
              <span className="block w-full max-w-8 rounded-t-md bg-gradient-to-t from-[#3f7ee0] to-[#79a8f1] transition group-hover:from-[#2268d4] group-hover:to-[#5591ec]" style={{ height }} />
              <span className="mt-1.5 whitespace-nowrap text-[9px] text-[#62728c]">{day.day_index === 0 ? "Hôm nay" : formatShortDate(day.date)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function DashboardBody({
  home,
  communes,
  onCommuneChange,
}: {
  home: { commune: Commune; forecast: CommuneForecast };
  communes: Commune[];
  onCommuneChange: (communeId: string) => void;
}) {
  const { official } = useRole();
  const router = useRouter();
  const [daySelection, setDaySelection] = useState({ communeId: home.commune.id, day: 0 });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedDay = daySelection.communeId === home.commune.id ? daySelection.day : 0;
  const selectedForecast = home.forecast.forecast.find((day) => day.day_index === selectedDay) ?? home.forecast.forecast[0];
  const updateLabel = (() => {
    const time = home.forecast.current?.time;
    if (!time) return "Chưa rõ thời gian cập nhật";
    const parsed = new Date(time);
    return `Cập nhật lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)}`;
  })();
  const isAssignedCommune = official?.commune_id === home.commune.id;

  async function handleSendAlert() {
    if (!official || !isAssignedCommune) {
      setToast("Bạn có thể xem thời tiết xã này nhưng chỉ được phát cảnh báo tại xã mình quản lý.");
      return;
    }
    if (!window.confirm(`Phát cảnh báo mới tới người dân tại ${home.commune.name}?`)) return;
    setSending(true);
    try {
      await sendOfficerAlert(home.commune.id, official?.id);
      setToast("Đã phát cảnh báo tới người dân trong xã.");
    } catch {
      setToast("Không phát được cảnh báo. Có thể nội dung mới trùng với cảnh báo gần nhất.");
    } finally {
      setSending(false);
    }
  }

  function exportReport() {
    const header = ["Ngày", "Điều kiện", "Nhiệt độ thấp nhất (°C)", "Nhiệt độ cao nhất (°C)", "Lượng mưa (mm)", "Xác suất mưa (%)", "Mức rủi ro"];
    const lines = home.forecast.forecast.map((day) => [
      day.date,
      day.condition ?? "",
      day.temp_min_c ?? "",
      day.temp_max_c ?? "",
      day.rain_sum_mm ?? "",
      day.rain_probability_max_percent ?? "",
      day.risk.label,
    ]);
    const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = `\uFEFF${[header, ...lines].map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bao-cao-${home.commune.id}-${home.forecast.forecast[0]?.date ?? "du-bao"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setToast("Đã xuất báo cáo dự báo 5 ngày.");
  }

  return (
    <main id="top" className="min-h-screen scroll-mt-24 bg-[#f7f9fc]">
      {toast && (
        <div role="status" className="fixed right-5 top-24 z-[100] max-w-sm rounded-xl border border-[#dce6f3] bg-white px-4 py-3 text-sm font-medium text-[#28456f] shadow-xl">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-[1920px] px-4 pb-8 pt-5 sm:px-6 2xl:px-7">
        <div className="flex flex-col gap-4 rounded-xl border border-[#e3e9f2] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <label className="relative min-w-0">
              <span className="sr-only">Chọn xã để xem thời tiết</span>
              <IconMapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4e6992]" stroke={1.8} />
              <select
                value={home.commune.id}
                onChange={(event) => onCommuneChange(event.target.value)}
                className="h-10 max-w-[330px] appearance-none rounded-full border border-[#dfe6ef] bg-[#f8faff] pl-9 pr-10 text-sm font-semibold text-[#213c68] outline-none transition focus:border-[#75a1eb]"
              >
                {communes.map((commune) => (
                  <option key={commune.id} value={commune.id}>{commune.name}, Điện Biên</option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#627795]" stroke={1.8} />
            </label>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="hidden text-xs font-medium text-[#667895] md:inline">Chế độ xem</span>
            <div className="inline-flex rounded-xl bg-[#f3f6fa] p-1">
              <button type="button" onClick={() => router.push("/")} className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-[#546987] transition hover:bg-white">
                <IconUsers className="h-4 w-4" /> Người dân
              </button>
              <button type="button" aria-pressed="true" className="flex h-9 items-center gap-2 rounded-lg bg-[#1769e0] px-3 text-xs font-semibold text-white shadow-sm">
                <IconBuildingCommunity className="h-4 w-4" /> Cán bộ xã
              </button>
            </div>
          </div>

          <p className="flex items-center justify-end gap-2 text-[11px] text-[#70809a] sm:min-w-[225px]">
            <IconRefresh className="h-4 w-4" stroke={1.8} /> {updateLabel}
          </p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.02fr]">
          <WeatherCard forecast={home.forecast} />
          <OfficerDashboardMap
            focusCommuneId={home.commune.id}
            focusCommuneName={home.commune.name}
            selectedDay={selectedForecast?.day_index ?? 0}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[2.1fr_1fr]">
          <AlertCard forecast={home.forecast} />
          <aside className="officer-panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#243f68]">
              <IconAlertTriangle className="h-5 w-5 text-[#1769e0]" stroke={1.8} /> Thao tác nhanh
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

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#d8e6f7] bg-[#edf5ff] px-4 py-2.5 text-[10px] leading-relaxed text-[#42638d]">
          <IconDownload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1769e0]" />
          Dữ liệu thời tiết được cập nhật từ Open-Meteo và cảnh báo NCHMF. Các chỉ số dự báo hỗ trợ cán bộ chủ động phòng tránh thiên tai, không thay thế bản tin chuyên môn chính thức.
        </div>
      </div>
      <FloatingChatWidget communeId={home.commune.id} />
    </main>
  );
}

export default function OfficialDashboard({ communes }: { communes: Commune[] }) {
  const { official, loading } = useRole();
  const [communeSelection, setCommuneSelection] = useState<{
    officialId: string;
    communeId: string;
  } | null>(null);
  const [forecastState, setForecastState] = useState<{
    officialId: string;
    communeId: string;
    forecast: CommuneForecast;
  } | null>(null);
  const [forecastErrorFor, setForecastErrorFor] = useState<string | null>(null);
  const selectedCommuneId = official && communeSelection?.officialId === official.id
    ? communeSelection.communeId
    : official?.commune_id ?? "";

  useEffect(() => {
    if (!official || !selectedCommuneId) {
      setForecastState(null);
      setForecastErrorFor(null);
      return;
    }

    let cancelled = false;
    setForecastErrorFor(null);
    fetchForecast(selectedCommuneId, 5)
      .then((forecast) => {
        if (!cancelled) setForecastState({ officialId: official.id, communeId: selectedCommuneId, forecast });
      })
      .catch(() => {
        if (!cancelled) setForecastErrorFor(`${official.id}:${selectedCommuneId}`);
      });
    return () => {
      cancelled = true;
    };
  }, [official, selectedCommuneId]);

  if (loading) {
    return <div className="skeleton mx-auto mt-8 h-[620px] max-w-[1500px] rounded-2xl" />;
  }
  if (!official) return <OfficialGate communes={communes} />;

  const assignedCommune = communes.find((commune) => commune.id === official.commune_id);
  const viewedCommune = communes.find((commune) => commune.id === selectedCommuneId);
  if (!assignedCommune) {
    return <div className="mx-auto mt-8 max-w-xl rounded-xl border border-[#ead9cc] bg-[#fff8f2] p-5 text-sm text-[#704326]">Không tìm thấy xã được phân công cho tài khoản này.</div>;
  }
  if (!viewedCommune) {
    return <div className="mx-auto mt-8 max-w-xl rounded-xl border border-[#ead9cc] bg-[#fff8f2] p-5 text-sm text-[#704326]">Không tìm thấy địa phương cần xem.</div>;
  }
  if (forecastErrorFor === `${official.id}:${selectedCommuneId}`) {
    return (
      <div className="mx-auto mt-8 max-w-xl rounded-xl border border-[#ead9cc] bg-[#fff8f2] p-5 text-sm text-[#704326]">
        <p>Chưa tải được dữ liệu của {viewedCommune.name}. Vui lòng thử lại sau.</p>
        {selectedCommuneId !== official.commune_id && (
          <button
            type="button"
            onClick={() => setCommuneSelection({ officialId: official.id, communeId: official.commune_id })}
            className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#704326] shadow-sm"
          >
            Xem lại xã của tôi
          </button>
        )}
      </div>
    );
  }
  if (!forecastState || forecastState.officialId !== official.id || forecastState.communeId !== selectedCommuneId) {
    return <div className="skeleton mx-auto mt-8 h-[620px] max-w-[1500px] rounded-2xl" />;
  }

  return (
    <DashboardBody
      communes={communes}
      home={{ commune: viewedCommune, forecast: forecastState.forecast }}
      onCommuneChange={(communeId) => setCommuneSelection({ officialId: official.id, communeId })}
    />
  );
}
