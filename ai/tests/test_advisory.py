from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from app.advisory import build_advisory
from app.api import create_advisory, create_advisory_debug
from app.schemas import (
    AdvisoryPayload,
    AdvisoryRequest,
    AdvisoryResponse,
    CompactAdvisoryResponse,
)


class AdvisoryBuilderTests(TestCase):
    def test_builds_stable_frontend_contract_from_tool_data(self):
        source_data = {
            "weather": {
                "source": "https://open-meteo.com/en/docs",
                "location": {
                    "display_name": "Tủa Chùa, Điện Biên",
                    "latitude": 21.9,
                    "longitude": 103.4,
                    "resolver": "test",
                },
                "forecast": {
                    "generated_at": "2026-07-18T00:00:00+00:00",
                    "model_timezone": "Asia/Ho_Chi_Minh",
                    "current": {
                        "time": "2026-07-18T07:00",
                        "temperature_c": 22,
                        "icon_key": "rain",
                    },
                    "risk_scale": {"level": 2},
                    "signals": [
                        {
                            "type": "heavy_rain",
                            "severity": 2,
                            "evidence": "Mưa ngày 70 mm",
                        }
                    ],
                    "daily": [
                        {"date": "2026-07-18", "rain_sum_mm": 70},
                        {"date": "2026-07-19", "rain_sum_mm": 10},
                    ],
                    "six_hour_periods": [
                        {"from": "2026-07-18T06:00", "to": "2026-07-18T11:00"}
                    ],
                },
            },
            "landslide": {
                "source": "https://luquetsatlo.nchmf.gov.vn/",
                "fetched_at": "2026-07-18T00:00:00+00:00",
                "requested_time": "2026-07-18T22:00:00+07:00",
                "forecast_window_hours": 6,
                "stale": False,
                "warnings": [
                    {
                        "commune": "Tủa Chùa",
                        "former_commune": "Sính Phình",
                        "landslide_risk": "Rất cao",
                        "flash_flood_risk": "Cao",
                    }
                ],
            },
        }

        result = build_advisory(
            commune="Tủa Chùa", answer="Bản tin thử nghiệm", source_data=source_data
        )
        validated = AdvisoryPayload.model_validate(result)

        self.assertEqual(validated.overall_risk.level, 3)
        self.assertEqual(validated.location.granularity, "point")
        self.assertIn("sms", validated.bulletin.channel_messages)
        self.assertEqual(validated.language_support.available, ["vi"])
        self.assertEqual(
            validated.language_support.translation_status["hmong"], "not_implemented"
        )
        self.assertIsNotNone(validated.daily_forecast[0].landslide)
        self.assertIsNotNone(validated.daily_forecast[1].landslide)
        self.assertEqual(
            validated.daily_forecast[0].landslide.valid_to,
            "2026-07-19T04:00:00+07:00",
        )
        self.assertNotIn(
            "affected_areas",
            validated.daily_forecast[0].landslide.model_dump(),
        )

    def test_marks_missing_official_warning_record_as_a_data_limit(self):
        result = build_advisory(
            commune="Mường Ảng",
            answer="Không có cảnh báo nổi bật.",
            source_data={
                "weather": {
                    "forecast": {
                        "generated_at": "2026-07-18T00:00:00+00:00",
                        "current": {},
                        "daily": [],
                        "six_hour_periods": [],
                        "signals": [],
                    }
                },
                "landslide": {"warnings": [], "stale": False},
            },
        )

        self.assertEqual(result["overall_risk"]["level"], 0)
        self.assertEqual(result["data_quality"]["status"], "degraded")
        self.assertTrue(result["data_quality"]["warnings"])

    def test_main_endpoint_returns_compact_frontend_response(self):
        agent_result = SimpleNamespace(
            answer="Bản tin thử nghiệm",
            commune="Tủa Chùa",
            model="test-model",
            tool_trace=[{"tool": "get_weather_forecast", "ok": True}],
            source_data={
                "weather": {
                    "forecast": {
                        "generated_at": "2026-07-18T00:00:00+00:00",
                        "current": {},
                        "daily": [],
                        "six_hour_periods": [],
                        "signals": [],
                    }
                },
                "landslide": {"warnings": []},
            },
        )
        with patch("app.api.agent.run", return_value=agent_result):
            response = create_advisory(AdvisoryRequest(commune="Tủa Chùa"))

        self.assertIsInstance(response, CompactAdvisoryResponse)
        self.assertEqual(response.schema_version, "1.1")
        self.assertEqual(response.advisory.location.commune, "Tủa Chùa")
        self.assertEqual(response.advisory.bulletin.text, "Bản tin thử nghiệm")
        self.assertIn("weather_details", response.links)
        self.assertNotIn("source_data", response.model_dump())
        self.assertNotIn("six_hour_forecast", response.advisory.model_dump())
        self.assertNotIn("risks", response.advisory.model_dump())
        self.assertNotIn("actions", response.advisory.model_dump())

    def test_debug_endpoint_keeps_full_agent_and_tool_data(self):
        agent_result = SimpleNamespace(
            answer="Bản tin thử nghiệm",
            commune="Tủa Chùa",
            model="test-model",
            tool_trace=[{"tool": "get_weather_forecast", "ok": True}],
            source_data={
                "weather": {
                    "forecast": {
                        "generated_at": "2026-07-18T00:00:00+00:00",
                        "current": {},
                        "daily": [],
                        "six_hour_periods": [],
                        "signals": [],
                    }
                },
                "landslide": {"warnings": []},
            },
        )
        with patch("app.api.agent.run", return_value=agent_result):
            response = create_advisory_debug(AdvisoryRequest(commune="Tủa Chùa"))

        self.assertIsInstance(response, AdvisoryResponse)
        self.assertEqual(response.answer, "Bản tin thử nghiệm")
        self.assertEqual(response.source_data, agent_result.source_data)
        self.assertTrue(response.tool_trace)
