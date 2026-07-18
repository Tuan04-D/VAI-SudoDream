"use client";

import { useState } from "react";
import type { Commune } from "@/lib/types";
import CommunePicker from "@/components/forecast/CommunePicker";

export default function PhoneAuthForm<T>({
  communes,
  defaultCommuneId,
  communeLabel,
  onLogin,
  onRegister,
  onDone,
}: {
  communes: Commune[];
  defaultCommuneId: string;
  communeLabel: string;
  onLogin: (phone: string, password: string) => Promise<T>;
  onRegister: (phone: string, password: string, displayName: string, communeId: string) => Promise<T>;
  onDone: (result: T) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [communeId, setCommuneId] = useState(defaultCommuneId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "login"
          ? await onLogin(phone.trim(), password)
          : await onRegister(phone.trim(), password, displayName.trim(), communeId);
      onDone(result);
    } catch {
      setError(
        mode === "login"
          ? "Sai số điện thoại hoặc mật khẩu."
          : "Không đăng ký được — số điện thoại có thể đã tồn tại, hoặc mật khẩu quá ngắn (tối thiểu 6 ký tự)."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
          {(
            [
              { key: "login", label: "Đã có tài khoản" },
              { key: "register", label: "Đăng ký mới" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                mode === opt.key ? "bg-primary text-primary-ink" : "text-ink-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Số điện thoại</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="09xxxxxxxx"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Mật khẩu</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 6 : undefined}
          placeholder={mode === "register" ? "Tối thiểu 6 ký tự" : undefined}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary"
        />
      </label>

      {mode === "register" && (
        <>
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
            <span className="font-medium text-ink">{communeLabel}</span>
            <CommunePicker communes={communes} value={communeId} onChange={setCommuneId} />
          </label>
        </>
      )}

      {error && <p className="text-sm text-risk-3">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}
      </button>
    </form>
  );
}
