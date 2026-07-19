"use client";

import { useEffect, useState } from "react";
import {
  IconBellRinging,
  IconChevronDown,
  IconCircleCheck,
  IconCloudRain,
  IconDroplet,
  IconMapPin,
  IconMountain,
  IconRoute,
  IconUmbrella,
  IconWind,
  IconX,
} from "@tabler/icons-react";
import {
  fetchCommuneAlerts,
  fetchForecast,
  loginResident,
  markAlertViewed,
  registerResident,
} from "@/lib/api";
import type { Commune, CommuneForecast, DayForecast, NotificationItem } from "@/lib/types";
import { useRole } from "@/lib/RoleProvider";
import { RISK_BG_CLASS, RISK_TEXT_CLASS, riskBg } from "@/lib/risk";
import WeatherIcon from "@/components/ui/WeatherIcon";
import HeroVideo from "@/components/home/HeroVideo";
import HazardBoard from "@/components/forecast/HazardBoard";
import PhoneAuthForm from "@/components/auth/PhoneAuthForm";
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";
import HazardSoundBanner from "./HazardSoundBanner";

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

function CommuneBar({
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
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
      <label className="relative min-w-0">
        <IconMapPin className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" stroke={1.8} />
        <select
          value={communeId}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 max-w-full appearance-none bg-transparent pl-6 pr-6 text-sm font-semibold text-ink outline-none"
        >
          {communes.map((commune) => (
            <option key={commune.id} value={commune.id}>{commune.name}, Điện Biên</option>
          ))}
        </select>
        <IconChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
      </label>

      <button
        type="button"
        onClick={onRegister}
        className={registered
          ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-risk-0/10 px-3 text-xs font-bold text-risk-0 ring-1 ring-risk-0/15"
          : "group inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-xs font-extrabold text-accent-ink shadow-[0_5px_16px_rgba(201,138,46,0.28)] ring-2 ring-white transition hover:-translate-y-0.5 hover:bg-[#d99a3d] hover:shadow-[0_8px_20px_rgba(201,138,46,0.34)]"
        }
      >
        {registered
          ? <IconCircleCheck className="h-4 w-4" stroke={1.8} />
          : <IconBellRinging className="h-4 w-4 transition-transform group-hover:rotate-[-8deg]" stroke={2} />
        }
        {registered ? "Đã đăng ký nhận cảnh báo" : "Đăng ký nhận cảnh báo"}
      </button>
    </div>
  );
}

function Hero({ forecast }: { forecast: CommuneForecast }) {
  const current = forecast.current;
  const today = forecast.forecast[0];
  const risk = forecast.overall_risk ?? today?.risk;

  return (
    <section className="relative min-h-[58vh] overflow-hidden sm:min-h-[64vh]">
      <HeroVideo />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/15" />
      <div className="bg-contour-light absolute inset-0 opacity-25" aria-hidden />
      <div className="relative flex min-h-[58vh] flex-col justify-end px-4 pb-8 pt-20 sm:min-h-[64vh] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {risk && (
            <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-bold text-white ${riskBg(risk)}`}>
              {risk.label}
            </span>
          )}
          <h1 className="font-display mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {forecast.commune.name}
          </h1>
          <p className="mt-1 text-sm text-white/75">
            Điện Biên · cập nhật {current?.time ? current.time.slice(11, 16) : "—"}
          </p>
          <div className="mt-6 flex items-end gap-4">
            <span className="font-data text-6xl font-bold leading-none text-white sm:text-7xl">
              {valueOrDash(current?.temperature_c ?? null, "°")}
            </span>
            <div className="pb-1.5">
              <p className="text-base font-semibold text-white">{current?.condition ?? today?.condition ?? "Đang cập nhật"}</p>
              <p className="mt-1 text-xs text-white/75">
                Cao nhất {valueOrDash(today?.temp_max_c ?? null, "°")} · Thấp nhất {valueOrDash(today?.temp_min_c ?? null, "°")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 border-l border-border pl-4 first:border-l-0 first:pl-0">
      <span className="text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <div className="min-w-0">
        <p className="font-data truncate text-sm font-bold text-ink">{value}</p>
        <p className="text-[10px] text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

function ConditionsStrip({ forecast }: { forecast: CommuneForecast }) {
  const current = forecast.current;
  const today = forecast.forecast[0];
  return (
    <div className="card card-raised mt-4 flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:mt-5">
      <WeatherIcon iconKey={current?.icon_key ?? today?.icon_key ?? null} className="h-12 w-12 shrink-0 text-primary" />
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <Stat icon={<IconDroplet />} label="Khả năng mưa" value={valueOrDash(today?.rain_probability_max_percent ?? null, "%")} />
        <Stat icon={<IconCloudRain />} label="Lượng mưa hôm nay" value={today?.rain_sum_mm == null ? "—" : `${today.rain_sum_mm.toFixed(1)} mm`} />
        <Stat icon={<IconWind />} label="Gió hiện tại" value={current?.wind_speed_kmh == null ? "—" : `${Math.round(current.wind_speed_kmh)} km/h`} />
        <Stat icon={<IconUmbrella />} label="Độ ẩm" value={valueOrDash(current?.humidity_percent ?? null, "%")} />
      </div>
    </div>
  );
}

function ResidentDailyGuide({ day }: { day: DayForecast }) {
  const rainProbability = day.rain_probability_max_percent ?? 0;
  const rainAmount = day.rain_sum_mm ?? 0;
  const rainyDay = rainProbability >= 50 || rainAmount >= 10;

  const items = [
    {
      icon: <IconUmbrella />,
      title: rainyDay ? "Ưu tiên áo mưa" : "Chủ động đồ đi mưa",
      detail: rainyDay
        ? `Khả năng mưa ${Math.round(rainProbability)}%, nên chuẩn bị trước khi đi nương hoặc ra chợ.`
        : "Thời tiết miền núi đổi nhanh; nên để sẵn áo mưa khi đi xa bản.",
    },
    {
      icon: <IconMountain />,
      title: "Quan sát taluy, khe suối",
      detail: "Chú ý nước đục, đất đá rơi, cây nghiêng hoặc vết nứt mới sau mưa.",
    },
    {
      icon: <IconRoute />,
      title: "Giữ đường liên lạc",
      detail: "Nếu đường vào bản sụt lún hoặc ngập sâu, báo ngay cho cán bộ và không tự đi qua.",
    },
  ];

  return (
    <section className="card grid overflow-hidden lg:grid-cols-[0.78fr_1.55fr]" aria-labelledby="daily-guide-title">
      <div className="bg-contour-light relative overflow-hidden bg-primary-dark p-5 text-white sm:p-6">
        <svg viewBox="0 0 320 90" className="absolute -bottom-1 right-0 h-24 w-full text-white opacity-10" fill="currentColor" aria-hidden>
          <path d="M0 90 55 42l28 23 50-53 48 48 36-31 34 33 31-18 38 46Z" />
        </svg>
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Bản tin dễ nhớ</p>
          <h2 id="daily-guide-title" className="font-display mt-2 text-xl font-extrabold leading-tight">
            Một phút chuẩn bị cho cả ngày
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">
            Ba việc nhỏ phù hợp với đường núi và sinh hoạt tại bản hôm nay.
          </p>
        </div>
      </div>

      <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item, index) => (
          <article key={item.title} className="group p-4 transition-colors hover:bg-primary/[0.035] sm:p-5">
            <div className="flex items-start gap-3 sm:block">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5 [&_svg]:h-5 [&_svg]:w-5">
                {item.icon}
              </span>
              <div className="sm:mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-accent">Việc {index + 1}</p>
                <h3 className="mt-0.5 text-sm font-bold text-ink">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-ink-muted">{item.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OfficerAlertNotice({
  alert,
  acknowledged,
  onAcknowledge,
}: {
  alert: NotificationItem;
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  const textClass = RISK_TEXT_CLASS[alert.risk_level] ?? RISK_TEXT_CLASS[0];
  const bgClass = RISK_BG_CLASS[alert.risk_level] ?? RISK_BG_CLASS[0];
  return (
    <article className="notice p-4" style={{ borderLeftColor: `var(--color-risk-${alert.risk_level})`, borderLeftWidth: 6 }}>
      <div className="flex items-start gap-3">
        <IconBellRinging className={`mt-0.5 h-5 w-5 shrink-0 ${textClass}`} stroke={1.8} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">Cảnh báo từ cán bộ xã</p>
            <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold text-white ${bgClass}`}>{alert.risk_label}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{alert.message_vi}</p>
          <button
            type="button"
            onClick={onAcknowledge}
            disabled={acknowledged}
            className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${textClass} disabled:opacity-50`}
          >
            <IconCircleCheck className="h-4 w-4" /> {acknowledged ? "Đã đọc cảnh báo" : "Tôi đã đọc"}
          </button>
        </div>
      </div>
    </article>
  );
}

function FiveDayForecast({ days }: { days: DayForecast[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-base font-bold text-ink">Dự báo 5 ngày</h2>
      <div className="mt-4 grid grid-cols-5 divide-x divide-border">
        {days.slice(0, 5).map((day) => (
          <div key={day.day_index} className="flex flex-col items-center gap-1.5 px-1 text-center sm:px-2">
            <p className="truncate text-[11px] font-bold text-ink">{dayLabel(day)}</p>
            <p className="text-[10px] text-ink-muted">{formatDate(day.date)}</p>
            <WeatherIcon iconKey={day.icon_key} className="my-1.5 h-7 w-7 text-primary" />
            <p className="font-data text-xs font-bold text-ink">
              {valueOrDash(day.temp_max_c, "°")} <span className="font-medium text-ink-muted">/{valueOrDash(day.temp_min_c, "°")}</span>
            </p>
            <p className="flex items-center gap-1 text-[10px] font-semibold text-primary">
              <IconDroplet className="h-3 w-3" /> {valueOrDash(day.rain_probability_max_percent, "%")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ResidentHome({
  communes,
  defaultCommuneId,
  initialForecast,
}: {
  communes: Commune[];
  defaultCommuneId: string;
  initialForecast: CommuneForecast;
}) {
  const { resident, setResident, loading } = useRole();
  const [communeId, setCommuneId] = useState(defaultCommuneId);
  const [syncedResidentId, setSyncedResidentId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<CommuneForecast | null>(initialForecast);
  const [latestAlert, setLatestAlert] = useState<NotificationItem | null>(null);
  const [loadedCommuneId, setLoadedCommuneId] = useState<string | null>(initialForecast.commune.id);
  const [showAuth, setShowAuth] = useState(false);
  const [acknowledgedAlertId, setAcknowledgedAlertId] = useState<string | null>(null);

  if (resident && resident.id !== syncedResidentId) {
    setSyncedResidentId(resident.id);
    setCommuneId(resident.commune_id);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchForecast(communeId, 5), fetchCommuneAlerts(communeId)])
      .then(([forecastData, alerts]) => {
        if (cancelled) return;
        setForecast(forecastData);
        setLatestAlert(alerts[0] ?? null);
        setLoadedCommuneId(communeId);
      })
      .catch(() => {
        if (cancelled) return;
        if (loadedCommuneId !== communeId) {
          setForecast(null);
          setLatestAlert(null);
          setLoadedCommuneId(communeId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [communeId, loadedCommuneId]);

  const activeForecast = loadedCommuneId === communeId ? forecast : null;
  const activeAlert = loadedCommuneId === communeId ? latestAlert : null;
  const loadComplete = loadedCommuneId === communeId;
  const today = activeForecast?.forecast[0];

  async function acknowledgeAlert() {
    if (!activeAlert || !resident) {
      setShowAuth(true);
      return;
    }
    if (resident.commune_id !== activeAlert.commune_id) return;
    try {
      await markAlertViewed(activeAlert.id, resident.id);
      setAcknowledgedAlertId(activeAlert.id);
    } catch {
      setAcknowledgedAlertId(null);
    }
  }

  return (
    <main className="min-h-screen bg-bg pb-24 lg:pb-10">
      <HazardSoundBanner communeId={communeId} />
      <CommuneBar
        communes={communes}
        communeId={communeId}
        onChange={(value) => {
          setCommuneId(value);
          setAcknowledgedAlertId(null);
        }}
        registered={!loading && !!resident}
        onRegister={() => setShowAuth(true)}
      />

      {!loadComplete ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="skeleton h-[58vh] sm:h-[64vh]" />
        </div>
      ) : !activeForecast ? (
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="notice p-6" style={{ borderLeftColor: "var(--color-risk-2)" }}>
            <p className="font-display text-lg font-bold text-ink">Chưa tải được dữ liệu thời tiết</p>
            <p className="mt-1 text-sm text-ink-muted">Vui lòng kiểm tra kết nối và tải lại trang sau ít phút.</p>
          </div>
        </div>
      ) : (
        <>
          <Hero forecast={activeForecast} />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ConditionsStrip forecast={activeForecast} />
            <div className="mt-4 flex flex-col gap-4">
              {today && <ResidentDailyGuide day={today} />}
              {activeAlert && (
                <OfficerAlertNotice
                  alert={activeAlert}
                  acknowledged={acknowledgedAlertId === activeAlert.id}
                  onAcknowledge={() => void acknowledgeAlert()}
                />
              )}
              {today && <HazardBoard day={today} />}
              <FiveDayForecast days={activeForecast.forecast} />
            </div>

            {!resident && (
              <section className="mt-4 flex flex-col gap-4 rounded-lg bg-primary-dark p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2 className="font-display text-lg font-bold">Nhận cảnh báo đúng xã của bạn</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">
                    Đăng ký tài khoản để hệ thống lưu xã và số điện thoại nhận cảnh báo.
                  </p>
                </div>
                <button type="button" onClick={() => setShowAuth(true)} className="h-11 shrink-0 rounded-md bg-white px-5 text-sm font-bold text-primary-dark transition hover:bg-white/90">
                  Đăng ký nhận cảnh báo
                </button>
              </section>
            )}

            <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-muted">
              Dữ liệu từ Open-Meteo và cảnh báo NCHMF. Hãy ưu tiên hướng dẫn trực tiếp của chính quyền địa phương khi có tình huống khẩn cấp.
            </p>
          </div>
        </>
      )}

      {showAuth && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Đăng ký nhận cảnh báo"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm"
          onClick={() => setShowAuth(false)}
        >
          <div className="card card-raised relative w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setShowAuth(false)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted transition hover:bg-surface-muted" aria-label="Đóng">
              <IconX className="h-5 w-5" />
            </button>
            <div className="mb-5 pr-8">
              <h2 className="font-display text-xl font-bold text-ink">Tài khoản người dân</h2>
              <p className="mt-1 text-sm leading-5 text-ink-muted">Đăng nhập hoặc đăng ký để nhận cảnh báo đúng địa bàn.</p>
            </div>
            <PhoneAuthForm
              communes={communes}
              defaultCommuneId={communeId}
              communeLabel="Xã của bạn"
              onLogin={loginResident}
              onRegister={registerResident}
              onDone={(user) => {
                setResident(user);
                setShowAuth(false);
              }}
            />
          </div>
        </div>
      )}

      <FloatingChatWidget communeId={communeId} />
    </main>
  );
}
