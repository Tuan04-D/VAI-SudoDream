"use client";

import { useEffect, useRef, useState } from "react";
import { fetchCommuneAlerts, markAlertViewed } from "@/lib/api";
import { playAlertSound } from "@/lib/audio/alertSound";
import { useRole } from "@/lib/RoleProvider";
import { RISK_BG_CLASS } from "@/lib/risk";
import type { NotificationItem } from "@/lib/types";

const POLL_MS = 45000;

export default function HazardSoundBanner({ communeId }: { communeId: string }) {
  const { resident } = useRole();
  const [activeAlert, setActiveAlert] = useState<NotificationItem | null>(null);
  const [trackedCommuneId, setTrackedCommuneId] = useState(communeId);
  const seenIdRef = useRef<string | null>(null);

  if (communeId !== trackedCommuneId) {
    setTrackedCommuneId(communeId);
    setActiveAlert(null);
  }

  useEffect(() => {
    seenIdRef.current = null;
    let cancelled = false;

    async function poll() {
      try {
        const alerts = await fetchCommuneAlerts(communeId);
        if (cancelled || alerts.length === 0) return;
        const latest = alerts[0];
        if (seenIdRef.current === null) {
          // First load for this commune: surface an already-active danger
          // silently — the sound is reserved for a *new* alert appearing
          // while the resident is already looking at the page.
          seenIdRef.current = latest.id;
          if (latest.risk_level >= 2) setActiveAlert(latest);
          return;
        }
        if (latest.id !== seenIdRef.current) {
          seenIdRef.current = latest.id;
          setActiveAlert(latest);
          playAlertSound(latest.hazard_type);
        }
      } catch {
        // offline / backend unreachable — resident view stays usable
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [communeId]);

  function dismiss() {
    if (activeAlert && resident) {
      markAlertViewed(activeAlert.id, resident.id).catch(() => {});
    }
    setActiveAlert(null);
  }

  if (!activeAlert) return null;

  return (
    <div
      role="alert"
      className={`fixed inset-x-4 top-4 z-50 flex items-center gap-3 rounded-lg p-4 text-white shadow-xl lg:inset-x-auto lg:right-8 lg:w-96 ${RISK_BG_CLASS[activeAlert.risk_level]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide opacity-90">{activeAlert.risk_label}</p>
        <p className="mt-1 text-sm font-semibold leading-snug">{activeAlert.message_vi}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full bg-black/20 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/30"
      >
        Đã xem
      </button>
    </div>
  );
}
