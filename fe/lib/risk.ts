import type { RiskInfo } from "./types";

export const RISK_BG_CLASS: Record<number, string> = {
  0: "bg-risk-0",
  1: "bg-risk-1",
  2: "bg-risk-2",
  3: "bg-risk-3",
};

export const RISK_TEXT_CLASS: Record<number, string> = {
  0: "text-risk-0",
  1: "text-risk-1",
  2: "text-risk-2",
  3: "text-risk-3",
};

export const RISK_BORDER_CLASS: Record<number, string> = {
  0: "border-risk-0",
  1: "border-risk-1",
  2: "border-risk-2",
  3: "border-risk-3",
};

export function riskBg(risk: RiskInfo): string {
  return RISK_BG_CLASS[risk.level] ?? RISK_BG_CLASS[0];
}

export function riskText(risk: RiskInfo): string {
  return RISK_TEXT_CLASS[risk.level] ?? RISK_TEXT_CLASS[0];
}

export function riskBorder(risk: RiskInfo): string {
  return RISK_BORDER_CLASS[risk.level] ?? RISK_BORDER_CLASS[0];
}
