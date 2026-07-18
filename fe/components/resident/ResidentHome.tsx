"use client";

<<<<<<< Updated upstream
import { useEffect, useMemo, useState } from "react";
=======
import { useEffect, useState } from "react";
import {
  IconBellRinging,
  IconChevronDown,
  IconCircleCheck,
  IconCloudRain,
  IconCrosshair,
  IconDroplet,
  IconMapPin,
  IconUmbrella,
  IconWind,
  IconX,
} from "@tabler/icons-react";
>>>>>>> Stashed changes
import {
  fetchCommunesGeoJson,
  fetchForecast,
<<<<<<< Updated upstream
  fetchForecastMap,
  fetchProvinceGeoJson,
  loginResident,
  registerResident,
} from "@/lib/api";
import type { Commune, CommuneForecast, MapCommuneDay } from "@/lib/types";
import { useRole } from "@/lib/RoleProvider";
import WeatherIcon from "@/components/ui/WeatherIcon";
import HazardBoard from "@/components/forecast/HazardBoard";
import ScopeToggle from "@/components/forecast/ScopeToggle";
import CommunePicker from "@/components/forecast/CommunePicker";
import ForecastMap from "@/components/forecast/ForecastMap";
import PhoneAuthForm from "@/components/auth/PhoneAuthForm";
=======
  fetchOfficerAlerts,
  fetchPointForecast,
  fetchRandomPointInCommune,
  fetchResidentPointTemperature,
  markAlertViewed,
} from "@/lib/api";
import type {
  Commune,
  CommuneForecast,
  DayForecast,
  NotificationItem,
  PointTemperature,
} from "@/lib/types";
import { useRole } from "@/lib/RoleProvider";
import { RISK_BG_CLASS, RISK_TEXT_CLASS, riskBg } from "@/lib/risk";
import WeatherIcon from "@/components/ui/WeatherIcon";
import HeroVideo from "@/components/home/HeroVideo";
import HazardBoard from "@/components/forecast/HazardBoard";
>>>>>>> Stashed changes
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";
import HeroVideo from "@/components/home/HeroVideo";
import HazardSoundBanner from "./HazardSoundBanner";

<<<<<<< Updated upstream
=======
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
  myLocationActive,
  locating,
  onUseMyLocation,
  onClearMyLocation,
}: {
  communes: Commune[];
  communeId: string;
  onChange: (value: string) => void;
  registered: boolean;
  onRegister: () => void;
  myLocationActive: boolean;
  locating: boolean;
  onUseMyLocation: () => void;
  onClearMyLocation: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-4">
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

        {myLocationActive ? (
          <button type="button" onClick={onClearMyLocation} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <IconCrosshair className="h-4 w-4" stroke={1.8} /> Đang xem vị trí của bạn
            <IconX className="h-3.5 w-3.5 text-ink-muted" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-primary disabled:opacity-60"
          >
            <IconCrosshair className="h-4 w-4" stroke={1.8} /> {locating ? "Đang lấy vị trí..." : "Lấy vị trí của tôi"}
          </button>
        )}
      </div>

      {registered ? (
        <button type="button" onClick={onRegister} className="inline-flex items-center gap-1.5 text-xs font-semibold text-risk-0">
          <IconCircleCheck className="h-4 w-4" stroke={1.8} /> Đã đăng ký
        </button>
      ) : (
        <button type="button" onClick={onRegister} className="text-xs font-semibold text-primary hover:text-primary-dark">
          Đăng ký nhận cảnh báo
        </button>
      )}
    </div>
  );
}

function Hero({
  forecast,
  pointTemperature,
}: {
  forecast: CommuneForecast;
  pointTemperature: PointTemperature | null;
}) {
  const current = forecast.current;
  const today = forecast.forecast[0];
  const risk = forecast.overall_risk ?? today?.risk;
  const pointDelta = pointTemperature
    ? Math.round((pointTemperature.temperature_c - pointTemperature.reference_temperature_c) * 10) / 10
    : null;

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
          <p className="mt-1 text-sm text-white/75">Điện Biên · cập nhật {current?.time ? current.time.slice(11, 16) : "—"}</p>

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

          {pointTemperature && pointDelta !== null && (
            <>
              <p className="mt-3 text-xs text-white/80">
                Tại vị trí của bạn (độ cao {Math.round(pointTemperature.elevation_m)}m):{" "}
                <span className="font-data font-bold text-white">{pointTemperature.temperature_c}°C</span>
                {Math.abs(pointDelta) >= 0.1 && (
                  <> ({pointDelta > 0 ? "+" : ""}{pointDelta}° so với trung tâm xã, đã hiệu chỉnh theo địa hình)</>
                )}
              </p>
              <p className="mt-1 text-[11px] text-white/60">
                Cảnh báo thiên tai bên dưới vẫn áp dụng chung toàn xã — dữ liệu NCHMF chỉ có ở cấp xã.
              </p>
            </>
          )}
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
    <div className="card card-raised relative z-10 -mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:-mt-12">
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

>>>>>>> Stashed changes
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
  const [scope, setScope] = useState<"commune" | "province">("commune");
  const [forecast, setForecast] = useState<CommuneForecast | null>(null);
<<<<<<< Updated upstream
  const [showAuth, setShowAuth] = useState(false);

  const [provinceGeoJson, setProvinceGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [communesGeoJson, setCommunesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mapToday, setMapToday] = useState<MapCommuneDay[] | null>(null);
=======
  const [latestAlert, setLatestAlert] = useState<NotificationItem | null>(null);
  const [loadedCommuneId, setLoadedCommuneId] = useState<string | null>(null);
  const [showSubscription, setShowSubscription] = useState(false);
  const [acknowledgedAlertId, setAcknowledgedAlertId] = useState<string | null>(null);
  const [pointTemperature, setPointTemperature] = useState<PointTemperature | null>(null);
  const [myLocationTemp, setMyLocationTemp] = useState<PointTemperature | null>(null);
  const [locating, setLocating] = useState(false);
>>>>>>> Stashed changes

  if (resident && resident.id !== syncedResidentId) {
    setSyncedResidentId(resident.id);
    setCommuneId(resident.commune_id);
  }

  useEffect(() => {
    const residentId = resident?.id;
    // No synchronous setState here for the logged-out case — the render
    // below already gates display on resident?.commune_id === communeId, so
    // stale state just stays unused rather than needing an explicit reset.
    if (!residentId) return;
    let cancelled = false;
    fetchResidentPointTemperature(residentId)
      .then((result) => !cancelled && setPointTemperature(result))
      .catch(() => !cancelled && setPointTemperature(null));
    return () => {
      cancelled = true;
    };
    // The endpoint resolves the resident's own registered commune server-side —
    // does not depend on whichever commune they're currently browsing below.
  }, [resident?.id]);

  useEffect(() => {
    let cancelled = false;
    fetchForecast(communeId, 5)
      .then((data) => !cancelled && setForecast(data))
      .catch(() => !cancelled && setForecast(null));
    return () => {
      cancelled = true;
    };
  }, [communeId]);

<<<<<<< Updated upstream
  useEffect(() => {
    if (scope !== "province" || provinceGeoJson) return;
    let cancelled = false;
    Promise.all([fetchProvinceGeoJson(), fetchCommunesGeoJson(), fetchForecastMap(0)])
      .then(([province, communesFc, mapDay]) => {
        if (cancelled) return;
        setProvinceGeoJson(province);
        setCommunesGeoJson(communesFc);
        setMapToday(mapDay.communes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scope, provinceGeoJson]);
=======
  const activeForecast = loadedCommuneId === communeId ? forecast : null;
  const activeAlert = loadedCommuneId === communeId ? latestAlert : null;
  const loadComplete = loadedCommuneId === communeId;
  const today = activeForecast?.forecast[0];
  const activePointTemperature = myLocationTemp ?? (resident?.commune_id === communeId ? pointTemperature : null);
>>>>>>> Stashed changes

  const valueByCommune = useMemo(() => {
    const out: Record<string, MapCommuneDay> = {};
    (mapToday || []).forEach((r) => (out[r.commune_id] = r));
    return out;
  }, [mapToday]);

  const commune = communes.find((c) => c.id === communeId) ?? communes[0];
  const today = forecast?.forecast[0];

  async function useMyLocation() {
    setLocating(true);
    try {
      const point = await fetchRandomPointInCommune(communeId);
      const result = await fetchPointForecast(communeId, point.lat, point.lon, 0);
      setMyLocationTemp(result);
    } catch {
      setMyLocationTemp(null);
    } finally {
      setLocating(false);
    }
  }

  return (
<<<<<<< Updated upstream
    <>
      <HazardSoundBanner communeId={communeId} />

      <section
        id="top"
        className="relative min-h-[calc(100dvh-5rem)] scroll-mt-20 overflow-hidden lg:min-h-[calc(100dvh-4.5rem)] lg:scroll-mt-24"
      >
        <HeroVideo />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1730]/95 via-[#16244a]/55 to-[#16244a]/20" />
        <div className="bg-contour-light absolute inset-0 opacity-30" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 hidden h-36 bg-gradient-to-b from-transparent to-bg lg:block" aria-hidden />

        <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col justify-end px-5 pb-24 pt-24 lg:min-h-[calc(100dvh-4.5rem)] lg:px-8 lg:pb-32">
          <div className="mx-auto flex w-full max-w-2xl items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                {resident ? "Xã của bạn" : "Đang xem"}
              </p>
              <h1 className="font-display text-3xl font-extrabold text-white lg:text-4xl">{commune?.name}</h1>
            </div>
            {!loading && !resident && (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="shrink-0 rounded-full border border-white/30 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                Đăng ký nhận cảnh báo
              </button>
=======
    <main className="min-h-screen bg-bg pb-24 lg:pb-10">
      <HazardSoundBanner communeId={communeId} />

      <CommuneBar
        communes={communes}
        communeId={communeId}
        onChange={(value) => {
          setCommuneId(value);
          setAcknowledgedAlertId(null);
          setMyLocationTemp(null);
        }}
        registered={!loading && !!resident}
        onRegister={() => setShowSubscription(true)}
        myLocationActive={!!myLocationTemp}
        locating={locating}
        onUseMyLocation={useMyLocation}
        onClearMyLocation={() => setMyLocationTemp(null)}
      />

      {!loadComplete ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="skeleton h-[58vh] sm:h-[64vh]" />
          <div className="mt-4 space-y-4">
            <div className="skeleton h-20 rounded-lg" />
            <div className="skeleton h-32 rounded-lg" />
          </div>
        </div>
      ) : !activeForecast ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="notice p-6 text-center" style={{ borderLeftColor: "var(--color-risk-2)" }}>
            <p className="font-display text-lg font-bold text-ink">Chưa tải được dữ liệu thời tiết</p>
            <p className="mt-1 text-sm text-ink-muted">Vui lòng kiểm tra kết nối và tải lại trang sau ít phút.</p>
          </div>
        </div>
      ) : (
        <>
          <Hero
            forecast={activeForecast}
            pointTemperature={activePointTemperature}
          />

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ConditionsStrip forecast={activeForecast} />

            <div className="mt-4 flex flex-col gap-4">
              {activeAlert && (
                <OfficerAlertNotice
                  alert={activeAlert}
                  acknowledged={acknowledgedAlertId === activeAlert.id}
                  onAcknowledge={acknowledgeAlert}
                />
              )}

              {today && <HazardBoard day={today} />}

              <FiveDayForecast days={activeForecast.forecast} />
            </div>

            {!resident && (
              <section className="mt-4 flex flex-col gap-4 rounded-lg bg-primary-dark p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2 className="font-display text-lg font-bold">Nhận cảnh báo đúng xã của bạn</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">Chỉ cần số điện thoại và nơi ở. Không cần tài khoản, không cần mật khẩu.</p>
                </div>
                <button type="button" onClick={() => setShowSubscription(true)} className="h-11 shrink-0 rounded-md bg-white px-5 text-sm font-bold text-primary-dark transition hover:bg-white/90">
                  Đăng ký nhận cảnh báo
                </button>
              </section>
>>>>>>> Stashed changes
            )}
          </div>
        </div>
      </section>

<<<<<<< Updated upstream
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 pb-10">
        {forecast?.current && (
          <div className="card card-raised relative z-10 -mt-16 flex items-center gap-4 p-5 lg:-mt-20">
            <WeatherIcon iconKey={forecast.current.icon_key} className="h-16 w-16 shrink-0 text-primary" />
            <div>
              <p className="font-display text-4xl font-extrabold tabular-nums">
                {forecast.current.temperature_c != null ? Math.round(forecast.current.temperature_c) : "--"}°
              </p>
              <p className="text-sm text-ink-muted">{forecast.current.condition}</p>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <ScopeToggle scope={scope} onChange={setScope} />
        </div>

      {scope === "commune" ? (
        today ? (
          <HazardBoard day={today} />
        ) : (
          <div className="skeleton h-32 rounded-lg" />
        )
      ) : (
        <div className="card overflow-hidden">
          <div className="relative h-[50vh]">
            {provinceGeoJson && communesGeoJson ? (
              <ForecastMap
                provinceGeoJson={provinceGeoJson}
                communesGeoJson={communesGeoJson}
                metric="risk"
                scope="province"
                focusCommuneId={communeId}
                valueByCommune={valueByCommune}
                domain={[0, 3]}
                onCommuneClick={(id) => {
                  setCommuneId(id);
                  setScope("commune");
                }}
              />
            ) : (
              <div className="skeleton h-full" />
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <CommunePicker communes={communes} value={communeId} onChange={setCommuneId} />
      </div>

      <p className="text-center text-[11px] text-ink-muted">
        Dữ liệu thời tiết (Open-Meteo) và cảnh báo sạt lở/lũ quét (NCHMF) là dữ liệu thật.
      </p>

      {showAuth && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAuth(false)}
        >
          <div
            className="card card-raised w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <PhoneAuthForm
=======
            <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-muted">
              Dữ liệu từ Open-Meteo và cảnh báo NCHMF. Hãy ưu tiên hướng dẫn trực tiếp của chính quyền địa phương khi có tình huống khẩn cấp.
            </p>
          </div>
        </>
      )}

      {showSubscription && (
        <div role="dialog" aria-modal="true" aria-label="Đăng ký nhận cảnh báo" className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm" onClick={() => setShowSubscription(false)}>
          <div className="card card-raised relative w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setShowSubscription(false)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted transition hover:bg-surface-muted" aria-label="Đóng">
              <IconX className="h-5 w-5" />
            </button>
            <div className="mb-5 pr-8">
              <h2 className="font-display text-xl font-bold text-ink">Nhận cảnh báo tại nơi bạn ở</h2>
              <p className="mt-1 text-sm leading-5 text-ink-muted">Cán bộ xã sẽ dùng thông tin này để gửi cảnh báo đúng địa bàn.</p>
            </div>
            <AlertSubscriptionForm
>>>>>>> Stashed changes
              communes={communes}
              defaultCommuneId={communeId}
              communeLabel="Xã của bạn"
              onLogin={loginResident}
              onRegister={registerResident}
              onDone={(r) => {
                setResident(r);
                setShowAuth(false);
              }}
            />
          </div>
        </div>
      )}

        <FloatingChatWidget communeId={communeId} />
      </div>
    </>
  );
}
