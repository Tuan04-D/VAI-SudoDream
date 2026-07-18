"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchCommunesGeoJson,
  fetchForecast,
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
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";
import HeroVideo from "@/components/home/HeroVideo";
import HazardSoundBanner from "./HazardSoundBanner";

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
  const [showAuth, setShowAuth] = useState(false);

  const [provinceGeoJson, setProvinceGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [communesGeoJson, setCommunesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mapToday, setMapToday] = useState<MapCommuneDay[] | null>(null);

  if (resident && resident.id !== syncedResidentId) {
    setSyncedResidentId(resident.id);
    setCommuneId(resident.commune_id);
  }

  useEffect(() => {
    let cancelled = false;
    fetchForecast(communeId, 5)
      .then((data) => !cancelled && setForecast(data))
      .catch(() => !cancelled && setForecast(null));
    return () => {
      cancelled = true;
    };
  }, [communeId]);

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

  const valueByCommune = useMemo(() => {
    const out: Record<string, MapCommuneDay> = {};
    (mapToday || []).forEach((r) => (out[r.commune_id] = r));
    return out;
  }, [mapToday]);

  const commune = communes.find((c) => c.id === communeId) ?? communes[0];
  const today = forecast?.forecast[0];

  return (
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
            )}
          </div>
        </div>
      </section>

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
