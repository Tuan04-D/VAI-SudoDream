export type Language = "vietnamese" | "hmong";

export interface Commune {
  id: string;
  name: string;
  kind: "xa" | "phuong";
  lat: number;
  lon: number;
}

/** 0-3 risk scale from the real AI service (fe/ai) — color/icon are theirs, used as-is. */
export interface RiskInfo {
  level: 0 | 1 | 2 | 3;
  label: string;
  color: string;
  icon: string;
}

export interface HazardWindow {
  severity: RiskInfo;
  valid_from: string | null;
  valid_to: string | null;
  official_warning: boolean;
}

/** Weather-derived hazard signal (heavy_rain, moderate_rain, frost, strong_wind,
 * thunderstorm, thunderstorm_hail) — see weather_ai/advisory.py RISK_TITLES. */
export interface HazardTag {
  type: string;
  title: string;
  severity: RiskInfo;
}

export interface ForecastConfidence {
  score: number;
  level: "high" | "medium" | "low";
  label: string;
  spread_precip_mm: number | null;
  spread_temp_c: number | null;
  models: string[];
}

export interface CurrentWeather {
  time: string | null;
  weather_code: number | null;
  condition: string | null;
  icon_key: string | null;
  icon: string | null;
  temperature_c: number | null;
  apparent_temperature_c: number | null;
  humidity_percent: number | null;
  precipitation_mm: number | null;
  rain_mm: number | null;
  cloud_cover_percent: number | null;
  visibility_m: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  wind_gust_kmh: number | null;
}

export interface DayForecast {
  commune_id: string;
  name: string;
  lat: number;
  lon: number;
  day_index: number;
  date: string;
  condition: string | null;
  icon: string | null;
  icon_key: string | null;
  weather_code: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  rain_sum_mm: number | null;
  rain_probability_max_percent: number | null;
  wind_gust_max_kmh: number | null;
  sunrise: string | null;
  sunset: string | null;
  risk: RiskInfo;
  landslide: HazardWindow | null;
  flash_flood: HazardWindow | null;
  hazards: HazardTag[];
  confidence?: ForecastConfidence | null;
}

export type MapCommuneDay = DayForecast;

export interface ForecastMapResponse {
  day_index: number;
  date: string;
  communes: MapCommuneDay[];
}

export interface Bulletin {
  language: string;
  title: string;
  text: string;
  sms_text: string;
}

export interface DataQuality {
  status: "good" | "degraded" | "unavailable";
  stale: boolean;
  warnings: string[];
}

export interface DataSourceItem {
  id: string;
  name: string;
  url: string | null;
  data_time: string | null;
  official_warning_source: boolean;
}

export interface LanguageSupport {
  available: string[];
  planned: string[];
  translation_status: Record<string, string>;
}

export interface CommuneForecast {
  commune: Commune;
  overall_risk: RiskInfo;
  current: CurrentWeather | null;
  forecast: DayForecast[];
  bulletin: Bulletin | null;
  language_support: LanguageSupport;
  data_quality: DataQuality;
  data_sources: DataSourceItem[];
  disclaimer: string;
  source: "advisory" | "fallback" | "unavailable";
}

export interface WarningResponse {
  commune_id: string;
  commune_name: string;
  date: string;
  overall_risk: RiskInfo;
  bulletin: Bulletin | null;
  data_quality: DataQuality;
  disclaimer: string;
  source: string;
}

export interface NotificationItem {
  id: string;
  commune_id: string;
  commune_name: string;
  date: string;
  risk_level: 0 | 1 | 2 | 3;
  risk_label: string;
  risk_color: string;
  hazard_type: string | null;
  message_vi: string;
  hmong_tts_text: string;
  audio_url: string | null;
  audio_language: "hmong";
  status: "auto" | "officer";
  sent_by: string | null;
  created_at: string;
}

export interface Resident {
  id: string;
  phone: string;
  display_name: string;
  commune_id: string;
  lat: number;
  lon: number;
  created_at: string;
  updated_at?: string;
  last_login_at?: string | null;
  role: "resident";
  status: "active" | "suspended" | "deleted";
  permissions: string[];
}

export interface Official {
  id: string;
  phone: string;
  display_name: string;
  commune_id: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string | null;
  role: "official";
  status: "active" | "suspended" | "deleted";
  permissions: string[];
}

export interface AdminUser {
  id: string;
  phone: string;
  display_name: string;
  commune_id: null;
  created_at: string;
  updated_at?: string;
  last_login_at?: string | null;
  role: "admin";
  status: "active" | "suspended" | "deleted";
  permissions: string[];
}

export type AuthUser = Resident | Official | AdminUser;

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
}

export interface ChatHistoryMessage {
  id: string;
  resident_id: string;
  role: "user" | "assistant";
  content: string;
  language: string;
  created_at: string;
}

export interface ViewedMapResident extends Resident {
  viewed: boolean;
}

export interface ViewedMapResponse {
  alert: NotificationItem;
  residents: ViewedMapResident[];
}

export type ChatContext = CommuneForecast;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
