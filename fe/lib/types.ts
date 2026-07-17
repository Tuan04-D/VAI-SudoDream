export type RiskLevel = "thap" | "trung_binh" | "cao" | "nguy_hiem";

export type HazardType = "binh_thuong" | "mua_lon" | "lu_quet" | "ret_hai" | "nang_nong";

export type Language = "vietnamese" | "hmong";

export interface Commune {
  id: string;
  name: string;
  kind: "xa" | "phuong";
  lat: number;
  lon: number;
}

export interface ForecastDay {
  day_index: number;
  date: string;
  temp_raw: number;
  temp_downscaled: number;
  precip_raw: number;
  precip_downscaled: number;
  precip_pi_90: [number, number];
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  hazard_type: HazardType;
  hazard_label: string;
  recommended_action: string;
}

export interface ForecastResponse {
  commune: Commune;
  forecast: ForecastDay[];
}

export interface MapCommuneDay extends ForecastDay {
  commune_id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface ForecastMapResponse {
  day_index: number;
  date: string;
  communes: MapCommuneDay[];
}

export interface WarningResponse extends ForecastDay {
  commune_id: string;
  commune_name: string;
  date: string;
  warning_text_vi: string;
}

export interface NotificationItem {
  id: string;
  commune_id: string;
  commune_name: string;
  date: string;
  risk_level: RiskLevel;
  hazard_type: HazardType;
  hazard_label: string;
  message_vi: string;
  hmong_tts_text: string;
  audio_url: string | null;
  audio_language: "hmong";
  created_at: string;
}

export interface ChatContext {
  commune: Commune;
  forecast: ForecastDay[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
