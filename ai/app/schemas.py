from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AdvisoryRequest(BaseModel):
    commune: str = Field(min_length=2, examples=["Tủa Chùa"])
    question: str | None = None
    days: int = Field(default=3, ge=1, le=7)
    latitude: float | None = None
    longitude: float | None = None


class RiskScale(BaseModel):
    level: int = Field(ge=0, le=3)
    label: str
    color: str
    icon: str


class AdvisoryLocation(BaseModel):
    commune: str
    province: str = "Điện Biên"
    display_name: str
    latitude: float | None = None
    longitude: float | None = None
    granularity: str
    resolver: str | None = None


class ValidityWindow(BaseModel):
    issued_at: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    timezone: str = "Asia/Ho_Chi_Minh"


class Bulletin(BaseModel):
    language: str
    title: str
    llm_text: str
    channel_messages: dict[str, str]
    translations: dict[str, str | None]


class CompactBulletin(BaseModel):
    language: str
    title: str
    text: str
    sms_text: str


class LanguageSupport(BaseModel):
    available: list[str]
    planned: list[str]
    translation_status: dict[str, str]


class DataSourceItem(BaseModel):
    id: str
    name: str
    url: str | None = None
    data_time: str | None = None
    official_warning_source: bool


class DataQuality(BaseModel):
    status: str
    stale: bool
    warnings: list[str]


class CurrentWeather(BaseModel):
    time: str | None = None
    weather_code: int | None = None
    condition: str | None = None
    icon_key: str | None = None
    icon: str | None = None
    temperature_c: float | None = None
    apparent_temperature_c: float | None = None
    humidity_percent: float | None = None
    precipitation_mm: float | None = None
    rain_mm: float | None = None
    cloud_cover_percent: float | None = None
    visibility_m: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    wind_gust_kmh: float | None = None


class DailyHazard(BaseModel):
    severity: RiskScale
    valid_from: str
    valid_to: str
    official_warning: bool


class DailyForecast(BaseModel):
    date: str | None = None
    weather_code: int | None = None
    condition: str | None = None
    icon_key: str | None = None
    icon: str | None = None
    temperature_min_c: float | None = None
    temperature_max_c: float | None = None
    apparent_temperature_min_c: float | None = None
    apparent_temperature_max_c: float | None = None
    rain_sum_mm: float | None = None
    rain_hours: float | None = None
    rain_probability_max_percent: float | None = None
    wind_gust_max_kmh: float | None = None
    sunrise: str | None = None
    sunset: str | None = None
    landslide: DailyHazard | None = None
    flash_flood: DailyHazard | None = None


class SixHourForecast(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    weather_code: int | None = None
    condition: str | None = None
    icon_key: str | None = None
    icon: str | None = None
    temperature_min_c: float | None = None
    temperature_max_c: float | None = None
    apparent_temperature_min_c: float | None = None
    apparent_temperature_max_c: float | None = None
    rain_mm: float | None = None
    rain_probability_max_percent: float | None = None
    humidity_max_percent: float | None = None
    visibility_min_m: float | None = None
    wind_speed_max_kmh: float | None = None
    wind_direction_at_max_deg: float | None = None
    wind_gust_max_kmh: float | None = None


class AdvisoryPayload(BaseModel):
    id: str
    overall_risk: RiskScale
    location: AdvisoryLocation
    validity: ValidityWindow
    current_weather: CurrentWeather
    daily_forecast: list[DailyForecast]
    six_hour_forecast: list[SixHourForecast]
    bulletin: Bulletin
    language_support: LanguageSupport
    data_sources: list[DataSourceItem]
    data_quality: DataQuality
    disclaimer: str


class CompactAdvisoryPayload(BaseModel):
    id: str
    overall_risk: RiskScale
    location: AdvisoryLocation
    validity: ValidityWindow
    current_weather: CurrentWeather
    daily_forecast: list[DailyForecast]
    bulletin: CompactBulletin
    language_support: LanguageSupport
    data_sources: list[DataSourceItem]
    data_quality: DataQuality
    disclaimer: str


class CompactAdvisoryResponse(BaseModel):
    schema_version: str
    advisory: CompactAdvisoryPayload
    links: dict[str, str]


class AdvisoryResponse(BaseModel):
    schema_version: str
    answer: str
    commune: str
    model: str
    advisory: AdvisoryPayload
    tool_trace: list[dict[str, Any]]
    source_data: dict[str, Any]
