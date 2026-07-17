from unittest import TestCase

from app.tools.weather import summarize_forecast


class WeatherSummaryTests(TestCase):
    def test_detects_heavy_rain_frost_fog_and_wind(self):
        hours = [f"2026-01-01T{hour:02d}:00" for hour in range(24)]
        payload = {
            "timezone": "Asia/Ho_Chi_Minh",
            "current": {
                "time": hours[0],
                "temperature_2m": 3,
                "precipitation": 2,
                "weather_code": 45,
                "wind_gusts_10m": 55,
            },
            "hourly": {
                "time": hours,
                "temperature_2m": [3] * 24,
                "relative_humidity_2m": [99] * 24,
                "precipitation_probability": [90] * 24,
                "precipitation": [6] * 6 + [0] * 18,
                "weather_code": [45] * 6 + [61] * 18,
                "wind_gusts_10m": [60] * 24,
            },
            "daily": {
                "time": ["2026-01-01"],
                "weather_code": [65],
                "temperature_2m_max": [8],
                "temperature_2m_min": [0],
                "precipitation_sum": [110],
                "precipitation_probability_max": [95],
                "wind_gusts_10m_max": [80],
            },
        }
        result = summarize_forecast(payload, 1)
        types = {item["type"] for item in result["signals"]}
        self.assertEqual(result["risk_scale"]["level"], 3)
        self.assertTrue({"heavy_rain", "frost", "fog", "strong_wind"} <= types)

