"use client";

import { useState } from "react";
import { IconUserCircle } from "@tabler/icons-react";
import { loginResident, registerResident, updateResidentProfile } from "@/lib/api";
import { useRole } from "@/lib/RoleProvider";
import type { Commune } from "@/lib/types";
import CommunePicker from "@/components/forecast/CommunePicker";
import PhoneAuthForm from "@/components/auth/PhoneAuthForm";

export default function ProfileEditor({ communes }: { communes: Commune[] }) {
  const { resident, official, setResident, setOfficial, loading } = useRole();
  const [displayName, setDisplayName] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [syncedResidentId, setSyncedResidentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (resident && resident.id !== syncedResidentId) {
    setSyncedResidentId(resident.id);
    setDisplayName(resident.display_name);
    setCommuneId(resident.commune_id);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!resident) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateResidentProfile(resident.id, displayName.trim(), communeId);
      setResident(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="skeleton mx-auto mt-8 h-48 w-full max-w-sm rounded-lg" />;
  }

  if (official) {
    const officialCommune = communes.find((c) => c.id === official.commune_id);
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-5 px-5 pt-12">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconUserCircle className="h-9 w-9" stroke={1.8} />
          </div>
          <h1 className="mt-3 font-display text-xl font-bold">Hồ sơ cán bộ xã</h1>
        </div>

        <div className="card flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-muted">Số điện thoại</span>
            <p className="font-data text-sm text-ink">{official.phone}</p>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-muted">Họ tên</span>
            <p className="text-sm text-ink">{official.display_name}</p>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-muted">Xã quản lý</span>
            <p className="text-sm text-ink">{officialCommune?.name ?? official.commune_id}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOfficial(null)}
          className="text-center text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Đăng xuất
        </button>
      </main>
    );
  }

  if (!resident) {
    return (
      <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-5 pt-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
          <IconUserCircle className="h-9 w-9" stroke={1.8} />
        </div>
        <h1 className="font-display text-xl font-bold">Chưa đăng nhập</h1>
        <p className="max-w-xs text-sm text-ink-muted">
          Đăng ký hoặc đăng nhập để lưu hồ sơ, nhận thống kê từ cán bộ xã và giữ lịch sử trò chuyện.
        </p>
        <div className="card w-full p-5 text-left">
          <PhoneAuthForm
            communes={communes}
            defaultCommuneId={communes[0]?.id ?? ""}
            communeLabel="Xã của bạn"
            onLogin={loginResident}
            onRegister={registerResident}
            onDone={setResident}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-5 px-5 pt-12">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconUserCircle className="h-9 w-9" stroke={1.8} />
        </div>
        <h1 className="mt-3 font-display text-xl font-bold">Hồ sơ của bạn</h1>
      </div>

      <form onSubmit={handleSave} className="card flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Số điện thoại</span>
          <input
            type="tel"
            value={resident.phone}
            disabled
            className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-ink-muted"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Họ tên</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Xã của bạn</span>
          <CommunePicker communes={communes} value={communeId} onChange={setCommuneId} />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        {saved && <p className="text-center text-xs text-risk-0">Đã lưu.</p>}
      </form>

      <button
        type="button"
        onClick={() => setResident(null)}
        className="text-center text-xs font-semibold text-ink-muted hover:text-ink"
      >
        Đăng xuất
      </button>
    </main>
  );
}
