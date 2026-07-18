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
import { loginOfficial, registerOfficial } from "@/lib/api";
import type { Commune, CommuneForecast, NotificationItem } from "@/lib/types";

function OfficialGate({ communes }: { communes: Commune[] }) {
  const { setOfficial } = useRole();
  const defaultCommuneId = communes[0]?.id ?? "";
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-5 px-5 py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconShieldCheck className="h-9 w-9" stroke={1.8} />
        </div>
        <h1 className="mt-3 font-display text-xl font-bold">Cán bộ xã</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Đăng nhập bằng số điện thoại để xem bản đồ rủi ro, bản tin AI và tình trạng người dân đã xem cảnh báo.
        </p>
      </div>
      <div className="card p-5">
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
  );
}

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
    </>
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
    return <div className="skeleton mx-5 mt-8 h-64 rounded-lg" />;
  }

  if (!official) {
    return <OfficialGate communes={props.communes} />;
  }

  return <DashboardBody {...props} />;
}
