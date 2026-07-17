"use client";

import clsx from "clsx";
import { motion } from "motion/react";

export default function ScopeToggle({
  scope,
  onChange,
}: {
  scope: "commune" | "province";
  onChange: (scope: "commune" | "province") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
      {(
        [
          { key: "commune", label: "Xã của tôi" },
          { key: "province", label: "Toàn tỉnh" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className="relative rounded-full px-3.5 py-1.5 font-medium transition-colors"
        >
          {scope === opt.key && (
            <motion.span
              layoutId="scope-toggle-active"
              className="absolute inset-0 rounded-full bg-primary"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className={clsx("relative z-10", scope === opt.key ? "text-primary-ink" : "text-ink-muted")}>
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
