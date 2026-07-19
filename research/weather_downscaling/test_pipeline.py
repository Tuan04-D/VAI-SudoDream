from __future__ import annotations

import math
import unittest

from common import _distance_km, load_points
from train_evaluate import RunningVectorStats, solve_linear_system


class PipelineUnitTests(unittest.TestCase):
    def test_point_sampling_is_deterministic_and_spatially_distinct(self) -> None:
        first = load_points(max_points=10)
        second = load_points(max_points=10)
        self.assertEqual([point["id"] for point in first], [point["id"] for point in second])
        self.assertEqual(10, len({point["id"] for point in first}))
        minimum_distance = min(
            _distance_km(a["lat"], a["lon"], b["lat"], b["lon"])
            for index, a in enumerate(first)
            for b in first[index + 1 :]
        )
        self.assertGreater(minimum_distance, 5)

    def test_running_statistics(self) -> None:
        stats = RunningVectorStats.create(2)
        stats.update([1.0, 2.0])
        stats.update([3.0, 6.0])
        self.assertEqual([2.0, 4.0], stats.mean)
        deviations = stats.standard_deviations()
        self.assertTrue(math.isclose(deviations[0], math.sqrt(2)))
        self.assertTrue(math.isclose(deviations[1], math.sqrt(8)))

    def test_linear_solver(self) -> None:
        solution = solve_linear_system([[3.0, 2.0], [1.0, 2.0]], [5.0, 5.0])
        self.assertAlmostEqual(0.0, solution[0])
        self.assertAlmostEqual(2.5, solution[1])


if __name__ == "__main__":
    unittest.main()

