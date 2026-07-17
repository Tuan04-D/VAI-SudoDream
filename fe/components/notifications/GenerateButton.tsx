"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateNotifications } from "@/lib/api";

export default function GenerateButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await generateNotifications();
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-primary/40 hover:text-primary active:enabled:scale-95 disabled:opacity-50"
    >
      {busy ? "Đang tạo..." : "Tạo thông báo mới"}
    </button>
  );
}
