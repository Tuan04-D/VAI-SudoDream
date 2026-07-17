"use client";

import type { Commune } from "@/lib/types";

export default function CommunePicker({
  communes,
  value,
  onChange,
}: {
  communes: Commune[];
  value: string;
  onChange: (id: string) => void;
}) {
  const sorted = [...communes].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-primary/40 focus-visible:border-primary"
      aria-label="Chọn xã"
    >
      {sorted.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
