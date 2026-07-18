import { Suspense } from "react";
import { fetchCommunes, fetchForecast, fetchNotifications } from "@/lib/api";
import OfficialDashboard from "@/components/officer/OfficialDashboard";
import type { Commune } from "@/lib/types";

async function loadHome(communeId?: string) {
  const { default_commune_id, communes } = await fetchCommunes();
  const heroCommuneId = communeId && communes.some((c) => c.id === communeId) ? communeId : default_commune_id;
  const commune = communes.find((c) => c.id === heroCommuneId) ?? communes[0];
  const forecast = await fetchForecast(commune.id, 1);
  return { communes, defaultCommuneId: default_commune_id, commune, forecast };
}

export default async function OfficerPage({
  searchParams,
}: {
  searchParams: Promise<{ commune?: string }>;
}) {
  const { commune: communeParam } = await searchParams;

  let home: Awaited<ReturnType<typeof loadHome>> | null = null;
  try {
    home = await loadHome(communeParam);
  } catch {
    home = null;
  }

  let notifications: Awaited<ReturnType<typeof fetchNotifications>> = [];
  let notifyError = false;
  try {
    notifications = await fetchNotifications(30);
  } catch {
    notifyError = true;
  }

  const communes: Commune[] = home?.communes ?? [];
  const focusCommuneId = communeParam && communes.some((c) => c.id === communeParam) ? communeParam : home?.defaultCommuneId;

  if (!home) {
    return (
      <div className="mx-5 mt-8 rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
        Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
        <code className="font-data">localhost:8000</code>.
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <OfficialDashboard
        communes={communes}
        notifications={notifications}
        notifyError={notifyError}
        home={{ commune: home.commune, forecast: home.forecast }}
        focusCommuneId={focusCommuneId}
        defaultCommuneId={home.defaultCommuneId}
      />
    </Suspense>
  );
}
