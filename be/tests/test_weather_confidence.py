import unittest

from weather_ai.tools.weather import (
    ENSEMBLE_MODELS,
    _day_ensemble_confidence,
    _ensemble_daily_confidence,
)


class EnsembleConfidenceTests(unittest.TestCase):
    def test_close_models_produce_high_confidence(self):
        result = _day_ensemble_confidence([20.0, 21.0, 19.0], [25.0, 25.4, 24.8])

        self.assertIsNotNone(result)
        self.assertEqual(result["level"], "high")
        self.assertGreaterEqual(result["score"], 0.75)
        self.assertEqual(result["models"], ENSEMBLE_MODELS)

    def test_wide_temperature_spread_produces_low_confidence(self):
        result = _day_ensemble_confidence([10.0, 10.0, 10.0], [20.0, 25.0, 30.0])

        self.assertIsNotNone(result)
        self.assertEqual(result["level"], "low")
        self.assertEqual(result["score"], 0.0)

    def test_payload_is_mapped_by_day_and_tolerates_missing_models(self):
        payload = {
            "daily": {
                "precipitation_sum_ecmwf_ifs025": [10.0, 4.0],
                "precipitation_sum_gfs_seamless": [11.0, 4.5],
                "temperature_2m_max_ecmwf_ifs025": [25.0, 24.0],
                "temperature_2m_max_gfs_seamless": [25.5, 24.3],
            }
        }

        result = _ensemble_daily_confidence(payload, 2)

        self.assertEqual(len(result), 2)
        self.assertTrue(all(item is not None for item in result))

    def test_one_model_is_not_enough_to_claim_confidence(self):
        result = _day_ensemble_confidence([10.0], [25.0])

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
