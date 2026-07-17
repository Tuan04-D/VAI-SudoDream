import type { HazardType, RiskLevel } from "./types";

export const RISK_LABEL: Record<RiskLevel, string> = {
  thap: "Thấp",
  trung_binh: "Trung bình",
  cao: "Cao",
  nguy_hiem: "Nguy hiểm",
};

export const RISK_COLOR_VAR: Record<RiskLevel, string> = {
  thap: "var(--color-risk-thap)",
  trung_binh: "var(--color-risk-trungbinh)",
  cao: "var(--color-risk-cao)",
  nguy_hiem: "var(--color-risk-nguyhiem)",
};

export const RISK_BG_CLASS: Record<RiskLevel, string> = {
  thap: "bg-risk-thap",
  trung_binh: "bg-risk-trungbinh",
  cao: "bg-risk-cao",
  nguy_hiem: "bg-risk-nguyhiem",
};

export const RISK_TEXT_CLASS: Record<RiskLevel, string> = {
  thap: "text-risk-thap",
  trung_binh: "text-risk-trungbinh",
  cao: "text-risk-cao",
  nguy_hiem: "text-risk-nguyhiem",
};

export const HAZARD_ICON: Record<HazardType, string> = {
  binh_thuong: "check-circle",
  mua_lon: "cloud-rain",
  lu_quet: "waves",
  ret_hai: "snowflake",
  nang_nong: "sun",
};

export function riskOrder(level: RiskLevel): number {
  return { thap: 0, trung_binh: 1, cao: 2, nguy_hiem: 3 }[level];
}
