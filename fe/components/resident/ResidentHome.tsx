"use client";

import { useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconBellRinging,
  IconChevronDown,
  IconCircleCheck,
  IconCloudRain,
  IconDroplet,
  IconMapPin,
  IconShieldCheck,
  IconUmbrella,
  IconWind,
  IconX,
} from "@tabler/icons-react";
import {
  fetchForecast,
  fetchOfficerAlerts,
  markAlertViewed,
} from "@/lib/api";
import type {
  Commune,
  CommuneForecast,
  DayForecast,
  NotificationItem,
  RiskInfo,
} from "@/lib/types";
import { useRole } from "@/lib/RoleProvider";
import WeatherIcon, { FlashFloodIcon, LandslideIcon } from "@/components/ui/WeatherIcon";
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";
import AlertSubscriptionForm from "./AlertSubscriptionForm";
import HazardSoundBanner from "./HazardSoundBanner";

const RISK_THEME: Record<number, {
  gradient: string;
  soft: string;
  border: string;
  text: string;
  status: string;
  summary: string;
}> = {
  0: {
    gradient: "from-[#14835b] via-[#1f9b70] to-[#53b88f]",
    soft: "bg-[#edf8f2]",
    border: "border-[#cfe9da]",
    text: "text-[#237a53]",
    status: "Thời tiết tương đối an toàn",
    summary: "Bạn có thể sinh hoạt bình thường và tiếp tục theo dõi thời tiết.",
  },
  1: {
    gradient: "from-[#ba7911] via-[#d9951e] to-[#edb94d]",
    soft: "bg-[#fff8e8]",
    border: "border-[#f1dfb3]",
    text: "text-[#a76d0f]",
    status: "Cần chú ý thời tiết",
    summary: "Nên chuẩn bị trước khi ra ngoài và theo dõi các thay đổi trong ngày.",
  },
  2: {
    gradient: "from-[#c95719] via-[#e36b24] to-[#f4964f]",
    soft: "bg-[#fff3eb]",
    border: "border-[#f2d1bd]",
    text: "text-[#c65319]",
    status: "Có nguy cơ thiên tai",
    summary: "Hạn chế đến khu vực nguy hiểm và làm theo hướng dẫn của cán bộ xã.",
  },
  3: {
    gradient: "from-[#a92727] via-[#c63c3c] to-[#e45d5d]",
    soft: "bg-[#fff0f0]",
    border: "border-[#efcaca]",
    text: "text-[#b52f2f]",
    status: "Nguy hiểm — cần hành động",
    summary: "Ưu tiên an toàn, không ra ngoài nếu không cần thiết và sẵn sàng sơ tán.",
  },
};

function dayLabel(day: DayForecast) {
  if (day.day_index === 0) return "Hôm nay";
  if (day.day_index === 1) return "Ngày mai";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short" })
    .format(new Date(`${day.date}T00:00:00`))
    .replace(/^./, (letter) => letter.toLocaleUpperCase("vi"));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${date}T00:00:00`)
  );
}

function valueOrDash(value: number | null, suffix = "") {
  return value == null ? "—" : `${Math.round(value)}${suffix}`;
}

function buildGuidance(today: DayForecast | undefined) {
  if (!today) return ["Theo dõi thông báo mới từ cán bộ xã."];
  const guidance: string[] = [];
  if (today.flash_flood) guidance.push("Không đi qua suối, ngầm tràn hoặc khu vực nước đang dâng.");
  if (today.landslide) guidance.push("Tránh xa sườn dốc, taluy và nơi có dấu hiệu đất đá nứt trượt.");
  if (today.hazards.some((hazard) => hazard.type.includes("thunderstorm"))) {
    guidance.push("Tránh trú dưới cây lớn, rút thiết bị điện khi có dông sét.");
  }
  if ((today.rain_probability_max_percent ?? 0) >= 70) {
    guidance.push("Mang áo mưa và kiểm tra đường đi trước khi ra ngoài.");
  }
  if ((today.wind_gust_max_kmh ?? 0) >= 35) {
    guidance.push("Gia cố mái che, đóng cửa và tránh đứng gần cây hoặc cột điện.");
  }
  if (guidance.length === 0) guidance.push("Sinh hoạt bình thường, chú ý cập nhật thời tiết trong ngày.");
  guidance.push("Giữ điện thoại có pin để nhận cảnh báo mới từ địa phương.");
  return [...new Set(guidance)].slice(0, 3);
}

function LocationBar({
  communes,
  communeId,
  onChange,
  registered,
  onRegister,
}: {
  communes: Commune[];
  communeId: string;
  onChange: (value: string) => void;
  registered: boolean;
  onRegister: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e1e7f0] bg-white px-4 py-3 shadow-[0_3px_14px_rgba(34,65,107,.045)] sm:flex-row sm:items-center sm:justify-between">
      <label className="relative min-w-0">
        <span className="mb-1 block text-[11px] font-medium text-[#78869c]">Địa phương đang xem</span>
        <IconMapPin className="pointer-events-none absolute bottom-2.5 left-0 h-4 w-4 text-[#3977cf]" stroke={1.8} />
        <select
          value={communeId}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 max-w-full appearance-none bg-transparent pl-6 pr-7 text-sm font-bold text-[#203b67] outline-none"
        >
          {communes.map((commune) => (
            <option key={commune.id} value={commune.id}>{commune.name}, Điện Biên</option>
          ))}
        </select>
        <IconChevronDown className="pointer-events-none absolute bottom-2.5 right-1 h-4 w-4 text-[#74849d]" />
      </label>

      {registered ? (
        <button type="button" onClick={onRegister} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#edf8f2] px-4 text-xs font-semibold text-[#247451] transition hover:bg-[#e2f3e9]">
          <IconCircleCheck className="h-5 w-5" stroke={1.8} /> Đã đăng ký · Cập nhật nơi ở
        </button>
      ) : (
        <button type="button" onClick={onRegister} className="h-10 rounded-xl bg-[#1769e0] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1159bd]">
          Đăng ký nhận cảnh báo
        </button>
      )}
    </div>
  );
}

function WeatherHero({ forecast }: { forecast: CommuneForecast }) {
  const current = forecast.current;
  const today = forecast.forecast[0];
  const risk = forecast.overall_risk ?? today?.risk;
  const theme = RISK_THEME[risk?.level ?? 0];
  return (
    <article className={`relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br ${theme.gradient} p-5 text-white shadow-[0_18px_45px_rgba(28,67,105,.18)] sm:p-7`}>
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
      <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/10" />
      <div className="relative grid gap-6 sm:grid-cols-[1.35fr_.65fr] sm:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm">
            {risk?.level === 0 ? <IconShieldCheck className="h-4 w-4" /> : <IconAlertTriangle className="h-4 w-4" />}
            {theme.status}
          </span>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-[-0.035em] sm:text-3xl">
            Hôm nay tại {forecast.commune.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">{theme.summary}</p>

          <div className="mt-6 flex items-end gap-4">
            <span className="font-data text-6xl font-bold leading-none tracking-[-0.06em]">
              {valueOrDash(current?.temperature_c ?? null, "°")}
            </span>
            <div className="pb-1">
              <p className="text-base font-semibold">{current?.condition ?? today?.condition ?? "Đang cập nhật"}</p>
              <p className="mt-1 text-xs text-white/75">
                Cao nhất {valueOrDash(today?.temp_max_c ?? null, "°")} · Thấp nhất {valueOrDash(today?.temp_min_c ?? null, "°")}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden justify-center sm:flex">
          <span className="flex h-36 w-36 items-center justify-center rounded-full bg-white/13 text-white backdrop-blur-sm">
            <WeatherIcon iconKey={current?.icon_key ?? today?.icon_key ?? null} className="h-24 w-24" />
          </span>
        </div>
      </div>
    </article>
  );
}

function KeyStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e3e8f0] bg-white p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-[#3977cf] [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-[#78869b]">{label}</p>
        <p className="font-data mt-1 truncate text-sm font-bold text-[#203b67]">{value}</p>
      </div>
    </div>
  );
}

function AlertCard({
  latestAlert,
  today,
  acknowledged,
  onAcknowledge,
}: {
  latestAlert: NotificationItem | null;
  today: DayForecast | undefined;
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  const forecastRisk: RiskInfo | null = [
    today?.landslide?.severity,
    today?.flash_flood?.severity,
    ...(today?.hazards.map((hazard) => hazard.severity) ?? []),
  ]
    .filter((risk): risk is RiskInfo => !!risk)
    .sort((a, b) => b.level - a.level)[0] ?? null;
  const level = latestAlert?.risk_level ?? forecastRisk?.level ?? 0;
  const theme = RISK_THEME[level];
  const hasWarning = !!latestAlert || !!forecastRisk;
  return (
    <article className={`rounded-2xl border ${theme.border} ${theme.soft} p-5`}>
      <div className="flex items-start gap-3.5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ${theme.text} shadow-sm`}>
          {hasWarning ? <IconBellRinging className="h-6 w-6" stroke={1.8} /> : <IconCircleCheck className="h-6 w-6" stroke={1.8} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={`text-base font-bold ${theme.text}`}>{hasWarning ? "Thông tin cần chú ý" : "Chưa có cảnh báo nguy hiểm"}</h2>
            {latestAlert && <span className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ${theme.text}`}>{latestAlert.risk_label}</span>}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-[#4f617d]">
            {latestAlert?.message_vi ?? (forecastRisk ? "Thời tiết có tín hiệu rủi ro. Hãy xem hướng dẫn an toàn bên dưới." : "Hiện chưa ghi nhận cảnh báo mới tại địa phương bạn đang xem.")}
          </p>
          {latestAlert && (
            <button
              type="button"
              onClick={onAcknowledge}
              disabled={acknowledged}
              className={`mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-semibold ${theme.text} shadow-sm transition hover:shadow disabled:opacity-60`}
            >
              <IconCircleCheck className="h-4 w-4" /> {acknowledged ? "Đã đọc cảnh báo" : "Tôi đã đọc"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FiveDayForecast({ days }: { days: DayForecast[] }) {
  return (
    <section className="rounded-2xl border border-[#e1e7f0] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#203b67]">Dự báo 5 ngày</h2>
          <p className="mt-0.5 text-[11px] text-[#7a889e]">Nhiệt độ và khả năng mưa tại xã</p>
        </div>
        <IconCloudRain className="h-6 w-6 text-[#4d82c9]" stroke={1.6} />
      </div>

      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {days.slice(0, 5).map((day) => (
          <div key={day.day_index} className="min-w-[112px] rounded-xl border border-[#e5eaf1] bg-[#fbfcfe] px-3 py-3 text-center sm:min-w-0">
            <p className="truncate text-[11px] font-bold text-[#344d72]">{dayLabel(day)}</p>
            <p className="mt-0.5 text-[10px] text-[#8390a3]">{formatDate(day.date)}</p>
            <WeatherIcon iconKey={day.icon_key} className="mx-auto my-2.5 h-8 w-8 text-[#6795c7]" />
            <p className="font-data text-xs font-bold text-[#203b67]">
              {valueOrDash(day.temp_max_c, "°")} <span className="font-medium text-[#8290a3]">/ {valueOrDash(day.temp_min_c, "°")}</span>
            </p>
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-[#3977cf]">
              <IconDroplet className="h-3 w-3" /> {valueOrDash(day.rain_probability_max_percent, "%")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GuidanceCard({ today }: { today: DayForecast | undefined }) {
  const guidance = buildGuidance(today);
  return (
    <section className="rounded-2xl border border-[#e1e7f0] bg-white p-5">
      <h2 className="text-base font-bold text-[#203b67]">Bạn nên làm gì hôm nay?</h2>
      <p className="mt-0.5 text-[11px] text-[#7a889e]">Hướng dẫn ngắn dựa trên dự báo hiện tại</p>
      <div className="mt-4 space-y-3">
        {guidance.map((item, index) => (
          <div key={item} className="flex items-start gap-3 rounded-xl bg-[#f7f9fc] px-3.5 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e4efff] text-xs font-bold text-[#2d6fc8]">{index + 1}</span>
            <p className="pt-1 text-sm leading-5 text-[#4d607d]">{item}</p>
          </div>
        ))}
      </div>

      {(today?.landslide || today?.flash_flood) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {today.landslide && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff2e9] px-3 py-1.5 text-[10px] font-bold text-[#c65b23]"><LandslideIcon className="h-4 w-4" /> Tránh vùng sạt lở</span>}
          {today.flash_flood && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf4ff] px-3 py-1.5 text-[10px] font-bold text-[#3977cf]"><FlashFloodIcon className="h-4 w-4" /> Tránh suối, ngầm tràn</span>}
        </div>
      )}
    </section>
  );
}

export default function ResidentHome({
  communes,
  defaultCommuneId,
}: {
  communes: Commune[];
  defaultCommuneId: string;
}) {
  const { resident, setResident, loading } = useRole();
  const [communeId, setCommuneId] = useState(defaultCommuneId);
  const [syncedResidentId, setSyncedResidentId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<CommuneForecast | null>(null);
  const [latestAlert, setLatestAlert] = useState<NotificationItem | null>(null);
  const [loadedCommuneId, setLoadedCommuneId] = useState<string | null>(null);
  const [showSubscription, setShowSubscription] = useState(false);
  const [acknowledgedAlertId, setAcknowledgedAlertId] = useState<string | null>(null);

  if (resident && resident.id !== syncedResidentId) {
    setSyncedResidentId(resident.id);
    setCommuneId(resident.commune_id);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchForecast(communeId, 5),
      fetchOfficerAlerts(communeId).catch(() => [] as NotificationItem[]),
    ])
      .then(([forecastData, alerts]) => {
        if (cancelled) return;
        setForecast(forecastData);
        setLatestAlert(alerts[0] ?? null);
        setLoadedCommuneId(communeId);
      })
      .catch(() => {
        if (cancelled) return;
        setForecast(null);
        setLatestAlert(null);
        setLoadedCommuneId(communeId);
      });
    return () => {
      cancelled = true;
    };
  }, [communeId]);

  const activeForecast = loadedCommuneId === communeId ? forecast : null;
  const activeAlert = loadedCommuneId === communeId ? latestAlert : null;
  const loadComplete = loadedCommuneId === communeId;
  const today = activeForecast?.forecast[0];
  const current = activeForecast?.current;

  async function acknowledgeAlert() {
    if (!activeAlert) return;
    setAcknowledgedAlertId(activeAlert.id);
    if (resident?.commune_id === communeId) markAlertViewed(activeAlert.id, resident.id).catch(() => {});
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-24 lg:pb-10">
      <HazardSoundBanner communeId={communeId} />

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <LocationBar
          communes={communes}
          communeId={communeId}
          onChange={(value) => {
            setCommuneId(value);
            setAcknowledgedAlertId(null);
          }}
          registered={!loading && !!resident}
          onRegister={() => setShowSubscription(true)}
        />

        {!loadComplete ? (
          <div className="mt-4 space-y-4">
            <div className="skeleton h-[300px] rounded-[1.4rem]" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-20 rounded-2xl" />)}
            </div>
          </div>
        ) : !activeForecast ? (
          <div className="mt-4 rounded-2xl border border-[#ead9cc] bg-[#fff8f2] p-6 text-center">
            <IconAlertTriangle className="mx-auto h-8 w-8 text-[#c46a31]" />
            <h1 className="mt-3 text-lg font-bold text-[#704326]">Chưa tải được dữ liệu thời tiết</h1>
            <p className="mt-1 text-sm text-[#80634f]">Vui lòng kiểm tra kết nối và tải lại trang sau ít phút.</p>
          </div>
        ) : (
          <>
            <div className="mt-4"><WeatherHero forecast={activeForecast} /></div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KeyStat icon={<IconDroplet />} label="Khả năng mưa" value={valueOrDash(today?.rain_probability_max_percent ?? null, "%")} />
              <KeyStat icon={<IconCloudRain />} label="Lượng mưa hôm nay" value={today?.rain_sum_mm == null ? "—" : `${today.rain_sum_mm.toFixed(1)} mm`} />
              <KeyStat icon={<IconWind />} label="Gió hiện tại" value={current?.wind_speed_kmh == null ? "—" : `${Math.round(current.wind_speed_kmh)} km/h`} />
              <KeyStat icon={<IconUmbrella />} label="Độ ẩm" value={valueOrDash(current?.humidity_percent ?? null, "%")} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
              <AlertCard
                latestAlert={activeAlert}
                today={today}
                acknowledged={acknowledgedAlertId === activeAlert?.id}
                onAcknowledge={acknowledgeAlert}
              />
              <GuidanceCard today={today} />
            </div>

            <div className="mt-4"><FiveDayForecast days={activeForecast.forecast} /></div>

            {!resident && (
              <section className="mt-4 flex flex-col gap-4 rounded-2xl bg-[#173b70] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2 className="text-lg font-bold">Nhận cảnh báo đúng xã của bạn</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">Chỉ cần số điện thoại và nơi ở. Không cần tài khoản, không cần mật khẩu.</p>
                </div>
                <button type="button" onClick={() => setShowSubscription(true)} className="h-11 shrink-0 rounded-xl bg-white px-5 text-sm font-bold text-[#173b70] transition hover:bg-[#edf4ff]">
                  Đăng ký nhận cảnh báo
                </button>
              </section>
            )}

            <p className="mt-4 text-center text-[10px] leading-relaxed text-[#8290a4]">
              Dữ liệu từ Open-Meteo và cảnh báo NCHMF. Hãy ưu tiên hướng dẫn trực tiếp của chính quyền địa phương khi có tình huống khẩn cấp.
            </p>
          </>
        )}
      </div>

      {showSubscription && (
        <div role="dialog" aria-modal="true" aria-label="Đăng ký nhận cảnh báo" className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f213d]/55 p-4 backdrop-blur-sm" onClick={() => setShowSubscription(false)}>
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setShowSubscription(false)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#74839a] transition hover:bg-[#f0f3f8]" aria-label="Đóng">
              <IconX className="h-5 w-5" />
            </button>
            <div className="mb-5 pr-8">
              <h2 className="text-xl font-bold text-[#203b67]">Nhận cảnh báo tại nơi bạn ở</h2>
              <p className="mt-1 text-sm leading-5 text-[#74839a]">Cán bộ xã sẽ dùng thông tin này để gửi cảnh báo đúng địa bàn.</p>
            </div>
            <AlertSubscriptionForm
              communes={communes}
              defaultCommuneId={communeId}
              currentSubscription={resident}
              onDone={(result) => {
                setResident(result);
                setCommuneId(result.commune_id);
                setAcknowledgedAlertId(null);
                setShowSubscription(false);
              }}
            />
          </div>
        </div>
      )}

      <FloatingChatWidget communeId={communeId} />
    </main>
  );
}
