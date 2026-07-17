"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { Language } from "@/lib/types";

export default function LanguageToggle({
  value,
  onChange,
}: {
  value: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
      {(
        [
          { key: "vietnamese", label: "Tiếng Việt" },
          { key: "hmong", label: "Hmoob" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className="relative rounded-full px-3.5 py-1.5 font-medium transition-colors"
        >
          {value === opt.key && (
            <motion.span
              layoutId="language-toggle-active"
              className="absolute inset-0 rounded-full bg-primary"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className={clsx("relative z-10", value === opt.key ? "text-primary-ink" : "text-ink-muted")}>
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
