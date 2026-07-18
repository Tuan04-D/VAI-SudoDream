"use client";

import { useEffect, useState } from "react";
import { fetchOfficerAlerts, fetchViewedMap, sendOfficerAlert } from "@/lib/api";
import type { Commune, NotificationItem, ViewedMapResponse } from "@/lib/types";
import CommunePicker from "@/components/forecast/CommunePicker";
import { useRole } from "@/lib/RoleProvider";
import ResidentViewMap from "./ResidentViewMap";

export default function ResidentViewMapSection({
  communes,
  defaultCommuneId,
}: {
  communes: Commune[];
  defaultCommuneId: string;
}) {
  const { official } = useRole();
  const [communeId, setCommuneId] = useState(defaultCommuneId);
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [viewedMap, setViewedMap] = useState<ViewedMapResponse | null>(null);
  const [trackedAlertId, setTrackedAlertId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedAlertId !== trackedAlertId) {
    setTrackedAlertId(selectedAlertId);
    setViewedMap(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetchOfficerAlerts(communeId)
      .then((items) => {
        if (cancelled) return;
        setAlerts(items);
        setSelectedAlertId(items[0]?.id ?? null);
      })
      .catch(() => !cancelled && setAlerts([]));
    return () => {
      cancelled = true;
    };
  }, [communeId]);

  useEffect(() => {
    if (!selectedAlertId) return;
    let cancelled = false;
    fetchViewedMap(selectedAlertId)
      .then((data) => !cancelled && setViewedMap(data))
      .catch(() => !cancelled && setViewedMap(null));
    return () => {
      cancelled = true;
    };
  }, [selectedAlertId]);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const alert = await sendOfficerAlert(communeId, official?.id);
      setAlerts((prev) => [alert, ...prev]);
      setSelectedAlertId(alert.id);
    } catch {
      setError("Không phát được cảnh báo — có thể chưa có thay đổi so với cảnh báo gần nhất cho xã này.");
    } finally {
      setSending(false);
    }
  }

  const viewedCount = viewedMap?.residents.filter((r) => r.viewed).length ?? 0;
  const totalCount = viewedMap?.residents.length ?? 0;
  const unviewedCount = totalCount - viewedCount;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold">Người dân đã xem cảnh báo</h2>
          <p className="text-sm text-ink-muted">Chấm xanh: đã xem · Chấm đỏ: chưa xem — chọn xã và đợt cảnh báo</p>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-ink transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {sending ? "Đang phát..." : "Phát cảnh báo cho xã này"}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <CommunePicker communes={communes} value={communeId} onChange={setCommuneId} />
        {alerts.length > 0 ? (
          <select
            value={selectedAlertId ?? ""}
            onChange={(e) => setSelectedAlertId(e.target.value)}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-ink"
            aria-label="Chọn đợt cảnh báo"
          >
            {alerts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} · {a.risk_label} {a.status === "officer" ? "(cán bộ phát)" : "(tự động)"}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-ink-muted">Chưa có đợt cảnh báo nào cho xã này.</span>
        )}
      </div>

      {error && <p className="text-xs text-risk-3">{error}</p>}

      {viewedMap && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Đã xem" value={viewedCount} color="var(--color-risk-0)" />
            <StatTile label="Chưa xem" value={unviewedCount} color="var(--color-risk-3)" />
            <StatTile label="Tổng số đăng ký" value={totalCount} color="var(--color-primary)" />
          </div>
          <div className="card overflow-hidden">
            <div className="relative h-[50vh]">
              <ResidentViewMap residents={viewedMap.residents} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
