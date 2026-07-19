"use client";

import { useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconClockExclamation,
  IconMapPin,
  IconShieldLock,
  IconUsers,
} from "@tabler/icons-react";
import { fetchOfficerAlerts, fetchViewedMap, sendOfficerAlert } from "@/lib/api";
import type { Commune, NotificationItem, ViewedMapResponse } from "@/lib/types";
import CommunePicker from "@/components/forecast/CommunePicker";
import { useRole } from "@/lib/RoleProvider";
import ResidentViewMap from "./ResidentViewMap";

function maskedPhone(phone: string) {
  const local = phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
  return local.length >= 7 ? `${local.slice(0, 3)}****${local.slice(-3)}` : "***";
}

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
  const selectedCommuneName = communes.find((commune) => commune.id === communeId)?.name ?? "Xã đang chọn";

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Đã xem" value={viewedCount} color="var(--color-risk-0)" />
            <StatTile label="Chưa xem" value={unviewedCount} color="var(--color-risk-3)" />
            <StatTile label="Tổng số đăng ký" value={totalCount} color="var(--color-primary)" />
          </div>

          <div className={`flex items-start gap-3 rounded-md px-4 py-3 text-sm ${unviewedCount > 0 ? "bg-risk-3/8 text-risk-3" : "bg-risk-0/8 text-risk-0"}`}>
            {unviewedCount > 0
              ? <IconClockExclamation className="mt-0.5 h-5 w-5 shrink-0" stroke={1.8} />
              : <IconCircleCheck className="mt-0.5 h-5 w-5 shrink-0" stroke={1.8} />
            }
            <p className="leading-5">
              {unviewedCount > 0
                ? `${unviewedCount} người dân chưa bấm “Tôi đã đọc” cho đợt cảnh báo này, nên bản đồ đang hiển thị ${unviewedCount} chấm đỏ.`
                : "Tất cả người dân đã đăng ký trong xã đều xác nhận đã đọc đợt cảnh báo này."
              }
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="grid lg:grid-cols-[1.5fr_.72fr]">
              <div className="relative h-[48vh] min-h-[360px] border-b border-border lg:border-b-0 lg:border-r">
                <ResidentViewMap residents={viewedMap.residents} communeId={communeId} />
                <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-white/90 p-2.5 text-[10px] font-semibold text-ink shadow-lg ring-1 ring-ink/5 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 font-bold text-primary-dark">
                    <IconMapPin className="h-3.5 w-3.5" /> {selectedCommuneName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-risk-0 ring-2 ring-white" /> Đã xem</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-risk-3 ring-2 ring-white" /> Chưa xem</span>
                  </div>
                </div>
              </div>

              <aside className="flex min-h-0 flex-col bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconUsers className="h-5 w-5" stroke={1.8} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Trạng thái từng người</h3>
                    <p className="text-[10px] text-ink-muted">Theo đợt cảnh báo đang chọn</p>
                  </div>
                </div>

                {viewedMap.residents.length > 0 ? (
                  <div className="scrollbar-none mt-4 flex max-h-[360px] flex-col gap-2 overflow-y-auto">
                    {viewedMap.residents.map((resident) => (
                      <article key={resident.id} className="flex items-center gap-3 rounded-md bg-surface-muted/70 p-3">
                        <span className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-white ${resident.viewed ? "bg-risk-0" : "bg-risk-3"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink">{resident.display_name}</p>
                          <p className="font-data text-[10px] text-ink-muted">{maskedPhone(resident.phone)}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold ${resident.viewed ? "text-risk-0" : "text-risk-3"}`}>
                          {resident.viewed ? "Đã xem" : "Chưa xem"}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md bg-surface-muted p-4 text-center text-xs leading-5 text-ink-muted">
                    Chưa có người dân đăng ký tại xã này.
                  </div>
                )}
              </aside>
            </div>
            <div className="flex items-start gap-2 border-t border-border bg-surface-muted/70 px-4 py-3 text-[10px] leading-4 text-ink-muted">
              <IconShieldLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Vị trí chấm là vị trí minh họa ngẫu nhiên trong phạm vi xã để bảo vệ riêng tư, không phải tọa độ GPS chính xác của người dân.
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
