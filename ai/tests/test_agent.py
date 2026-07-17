from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase

from app.agent import DienBienWeatherAgent
from app.config import Settings


class FakeResponses:
    def __init__(self):
        self.calls = 0

    def create(self, **_: object) -> SimpleNamespace:
        self.calls += 1
        if self.calls == 1:
            return SimpleNamespace(
                output=[
                    SimpleNamespace(
                        type="function_call",
                        name="get_weather_forecast",
                        arguments='{"commune":"ignored","days":2,"latitude":null,"longitude":null}',
                        call_id="weather-1",
                    ),
                    SimpleNamespace(
                        type="function_call",
                        name="get_landslide_warnings",
                        arguments='{"commune":"ignored"}',
                        call_id="landslide-1",
                    ),
                ],
                output_text="",
            )
        return SimpleNamespace(
            output=[SimpleNamespace(type="message")],
            output_text="🔴 Bản tin kiểm thử",
        )


class FakeLandslideService:
    def get_warnings(self, commune: str):
        return {"requested_commune": commune, "warning_count": 1}


class FakeWeatherService:
    def get_forecast(self, commune: str, days: int, latitude=None, longitude=None):
        return {"requested_commune": commune, "days": days}


class AgentTests(TestCase):
    def test_agent_executes_both_tools_before_final_answer(self):
        client = SimpleNamespace(responses=FakeResponses())
        settings = Settings(
            openai_api_key="test",
            openai_model="test-model",
            landslide_refresh_hours=6,
            http_timeout_seconds=30,
            landslide_cache_path=Path("unused.json"),
        )
        agent = DienBienWeatherAgent(
            settings=settings,
            landslide_service=FakeLandslideService(),
            weather_service=FakeWeatherService(),
            client=client,
        )
        result = agent.run("Tủa Chùa", days=2)
        self.assertEqual(result.answer, "🔴 Bản tin kiểm thử")
        self.assertEqual(
            {item["tool"] for item in result.tool_trace},
            {"get_weather_forecast", "get_landslide_warnings"},
        )
        self.assertEqual(
            result.source_data["get_weather_forecast"]["requested_commune"],
            "Tủa Chùa",
        )
