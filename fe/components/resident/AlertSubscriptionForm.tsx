"use client";

import { useState } from "react";
import CommunePicker from "@/components/forecast/CommunePicker";
import { subscribeResident } from "@/lib/api";
import type { Commune, Resident } from "@/lib/types";

export default function AlertSubscriptionForm({
  communes,
  defaultCommuneId,
  currentSubscription,
  onDone,
}: {
  communes: Commune[];
  defaultCommuneId: string;
  currentSubscription?: Resident | null;
  onDone: (resident: Resident) => void;
}) {
  const [phone, setPhone] = useState(currentSubscription?.phone ?? "");
  const [address, setAddress] = useState(currentSubscription?.address ?? "");
  const [communeId, setCommuneId] = useState(
    currentSubscription?.commune_id ?? defaultCommuneId
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone.trim() || !address.trim() || !communeId) return;

    setBusy(true);
    setError(null);
    try {
      const result = await subscribeResident(phone.trim(), address.trim(), communeId);
      onDone(result);
    } catch {
      setError("Chưa lưu được thông tin. Vui lòng kiểm tra số điện thoại và thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="rounded-xl bg-[#edf5ff] px-3.5 py-3 text-xs font-medium leading-5 text-[#315f99]">
        Không cần tạo tài khoản hay nhớ mật khẩu.
      </p>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-[#203b67]">Số điện thoại nhận cảnh báo</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          minLength={9}
          maxLength={20}
          placeholder="Ví dụ: 0912 345 678"
          className="h-12 rounded-xl border border-[#d7e0ec] bg-white px-3.5 text-base text-[#203b67] outline-none transition focus:border-[#4f89df] focus:ring-2 focus:ring-[#dceaff]"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-[#203b67]">Xã / phường nơi đang ở</span>
        <CommunePicker communes={communes} value={communeId} onChange={setCommuneId} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-[#203b67]">Bản, thôn hoặc địa chỉ cụ thể</span>
        <input
          type="text"
          autoComplete="street-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required
          minLength={2}
          maxLength={200}
          placeholder="Ví dụ: Bản Nà Tấu, gần nhà văn hóa"
          className="h-12 rounded-xl border border-[#d7e0ec] bg-white px-3.5 text-base text-[#203b67] outline-none transition focus:border-[#4f89df] focus:ring-2 focus:ring-[#dceaff]"
        />
      </label>

      {error && <p role="alert" className="text-sm font-medium text-[#b33232]">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-xl bg-[#1769e0] px-5 text-base font-bold text-white shadow-sm transition hover:bg-[#1159bd] disabled:cursor-wait disabled:opacity-60"
      >
        {busy
          ? "Đang lưu..."
          : currentSubscription
            ? "Cập nhật nơi nhận cảnh báo"
            : "Đăng ký nhận cảnh báo"}
      </button>
    </form>
  );
}
