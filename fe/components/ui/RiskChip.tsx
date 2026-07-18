import clsx from "clsx";
import type { RiskInfo } from "@/lib/types";
import { riskBg } from "@/lib/risk";

export default function RiskChip({ risk, className }: { risk: RiskInfo; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-bold text-white",
        riskBg(risk),
        className
      )}
    >
      {risk.label}
    </span>
  );
}
