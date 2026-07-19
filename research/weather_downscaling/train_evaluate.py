from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from common import ARTIFACTS_DIR, DATA_DIR, sha256_file


TARGETS = ("temperature_2m", "relative_humidity_2m")
FEATURE_NAMES = (
    "raw_temperature_2m",
    "raw_relative_humidity_2m",
    "raw_precipitation",
    "raw_wind_speed_10m",
    "raw_wind_gusts_10m",
    "raw_cloud_cover",
    "latitude",
    "longitude",
    "elevation_m",
    "orographic_delta_m",
    "slope_deg",
    "aspect_sin",
    "aspect_cos",
    "tpi_m",
    "delta_h_m",
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train and evaluate residual weather correction models.")
    parser.add_argument("--dataset", type=Path, default=DATA_DIR / "processed" / "hourly_pairs.csv.gz")
    parser.add_argument("--manifest", type=Path, default=ARTIFACTS_DIR / "dataset_manifest.json")
    parser.add_argument("--temporal-cutoff", help="UTC timestamp/date; defaults to the midpoint of the dataset")
    parser.add_argument("--spatial-holdout-every", type=int, default=5)
    parser.add_argument("--ridge-alpha", type=float, default=0.1)
    parser.add_argument("--model-output", type=Path, default=ARTIFACTS_DIR / "residual_model.json")
    parser.add_argument("--metrics-output", type=Path, default=ARTIFACTS_DIR / "metrics.json")
    parser.add_argument("--model-card", type=Path, default=ARTIFACTS_DIR / "MODEL_CARD.md")
    return parser.parse_args()


def open_rows(path: Path) -> Iterator[dict[str, str]]:
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)


def numeric(row: dict[str, str], key: str) -> float:
    value = row.get(key)
    if value in (None, "", "None", "null"):
        raise ValueError(f"Missing numeric value {key}")
    return float(value)


def features(row: dict[str, str]) -> list[float]:
    timestamp = parse_timestamp(row["timestamp_utc"])
    hour_angle = 2 * math.pi * timestamp.hour / 24
    year_days = 366 if timestamp.year % 4 == 0 else 365
    day_angle = 2 * math.pi * (timestamp.timetuple().tm_yday - 1) / year_days
    aspect_angle = math.radians(numeric(row, "aspect_deg"))
    return [
        numeric(row, "raw_temperature_2m"),
        numeric(row, "raw_relative_humidity_2m"),
        numeric(row, "raw_precipitation"),
        numeric(row, "raw_wind_speed_10m"),
        numeric(row, "raw_wind_gusts_10m"),
        numeric(row, "raw_cloud_cover"),
        numeric(row, "latitude"),
        numeric(row, "longitude"),
        numeric(row, "elevation_m"),
        numeric(row, "elevation_m") - numeric(row, "gfs_grid_elevation_m"),
        numeric(row, "slope_deg"),
        math.sin(aspect_angle),
        math.cos(aspect_angle),
        numeric(row, "tpi_m"),
        numeric(row, "delta_h_m"),
        math.sin(hour_angle),
        math.cos(hour_angle),
        math.sin(day_angle),
        math.cos(day_angle),
    ]


@dataclass
class RunningVectorStats:
    count: int
    mean: list[float]
    m2: list[float]

    @classmethod
    def create(cls, size: int) -> "RunningVectorStats":
        return cls(0, [0.0] * size, [0.0] * size)

    def update(self, values: list[float]) -> None:
        self.count += 1
        for index, value in enumerate(values):
            delta = value - self.mean[index]
            self.mean[index] += delta / self.count
            self.m2[index] += delta * (value - self.mean[index])

    def standard_deviations(self) -> list[float]:
        if self.count < 2:
            raise ValueError("At least two training rows are required")
        return [max(math.sqrt(value / (self.count - 1)), 1e-9) for value in self.m2]


@dataclass
class ErrorStats:
    count: int = 0
    baseline_abs: float = 0.0
    baseline_squared: float = 0.0
    corrected_abs: float = 0.0
    corrected_squared: float = 0.0
    corrected_signed: float = 0.0

    def add(self, baseline_error: float, corrected_error: float) -> None:
        self.count += 1
        self.baseline_abs += abs(baseline_error)
        self.baseline_squared += baseline_error * baseline_error
        self.corrected_abs += abs(corrected_error)
        self.corrected_squared += corrected_error * corrected_error
        self.corrected_signed += corrected_error

    def result(self) -> dict[str, Any]:
        if not self.count:
            return {"n": 0}
        baseline_mae = self.baseline_abs / self.count
        corrected_mae = self.corrected_abs / self.count
        return {
            "n": self.count,
            "baseline_mae": round(baseline_mae, 4),
            "corrected_mae": round(corrected_mae, 4),
            "baseline_rmse": round(math.sqrt(self.baseline_squared / self.count), 4),
            "corrected_rmse": round(math.sqrt(self.corrected_squared / self.count), 4),
            "corrected_bias": round(self.corrected_signed / self.count, 4),
            "mae_skill_percent": round(100 * (1 - corrected_mae / baseline_mae), 2)
            if baseline_mae > 0
            else None,
        }


def solve_linear_system(matrix: list[list[float]], vector: list[float]) -> list[float]:
    size = len(vector)
    augmented = [matrix[row][:] + [vector[row]] for row in range(size)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            raise ValueError("Singular normal-equation matrix")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        scale = augmented[column][column]
        augmented[column] = [value / scale for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            if factor:
                augmented[row] = [
                    current - factor * pivot_value
                    for current, pivot_value in zip(augmented[row], augmented[column])
                ]
    return [augmented[row][-1] for row in range(size)]


def scan_dataset(path: Path) -> tuple[list[str], datetime, datetime, set[str]]:
    point_ids: set[str] = set()
    terrain_sources: set[str] = set()
    minimum: datetime | None = None
    maximum: datetime | None = None
    for row in open_rows(path):
        point_ids.add(row["point_id"])
        terrain_sources.add(row["terrain_source"])
        timestamp = parse_timestamp(row["timestamp_utc"])
        minimum = timestamp if minimum is None or timestamp < minimum else minimum
        maximum = timestamp if maximum is None or timestamp > maximum else maximum
    if minimum is None or maximum is None:
        raise ValueError("Dataset is empty")
    return sorted(point_ids), minimum, maximum, terrain_sources


def select_spatial_holdout(point_ids: list[str], every: int) -> set[str]:
    if every < 3:
        raise ValueError("spatial-holdout-every must be at least 3")
    holdout = {point_id for index, point_id in enumerate(point_ids) if index % every == 0}
    if not holdout or len(holdout) == len(point_ids):
        raise ValueError("Invalid spatial holdout split")
    return holdout


def normalized(values: list[float], means: list[float], standard_deviations: list[float]) -> list[float]:
    return [(value - mean) / std for value, mean, std in zip(values, means, standard_deviations)]


def predict_residual(
    values: list[float], means: list[float], standard_deviations: list[float], coefficients: list[float]
) -> float:
    z_values = normalized(values, means, standard_deviations)
    return coefficients[0] + sum(coef * value for coef, value in zip(coefficients[1:], z_values))


def fit_models(
    path: Path,
    cutoff: datetime,
    spatial_holdout: set[str],
    ridge_alpha: float,
) -> tuple[RunningVectorStats, dict[str, list[float]], int]:
    stats = RunningVectorStats.create(len(FEATURE_NAMES))
    for row in open_rows(path):
        if row["point_id"] not in spatial_holdout and parse_timestamp(row["timestamp_utc"]) < cutoff:
            stats.update(features(row))
    stds = stats.standard_deviations()

    size = len(FEATURE_NAMES) + 1
    matrices = {target: [[0.0] * size for _ in range(size)] for target in TARGETS}
    vectors = {target: [0.0] * size for target in TARGETS}
    training_rows = 0
    for row in open_rows(path):
        if row["point_id"] in spatial_holdout or parse_timestamp(row["timestamp_utc"]) >= cutoff:
            continue
        training_rows += 1
        x = [1.0] + normalized(features(row), stats.mean, stds)
        for target in TARGETS:
            raw = numeric(row, f"raw_{target}")
            residual = numeric(row, f"target_{target}") - raw
            matrix = matrices[target]
            vector = vectors[target]
            for i in range(size):
                vector[i] += x[i] * residual
                for j in range(i, size):
                    matrix[i][j] += x[i] * x[j]

    coefficients: dict[str, list[float]] = {}
    for target in TARGETS:
        matrix = matrices[target]
        for i in range(size):
            for j in range(i):
                matrix[i][j] = matrix[j][i]
        for i in range(1, size):
            matrix[i][i] += ridge_alpha
        coefficients[target] = solve_linear_system(matrix, vectors[target])
    return stats, coefficients, training_rows


def subset_names(point_id: str, timestamp: datetime, cutoff: datetime, spatial_holdout: set[str]) -> list[str]:
    if point_id in spatial_holdout:
        names = ["spatial_holdout_all"]
        if timestamp >= cutoff:
            names.append("spatiotemporal_holdout")
        return names
    return ["temporal_holdout"] if timestamp >= cutoff else ["train_fit"]


def evaluate(
    path: Path,
    cutoff: datetime,
    spatial_holdout: set[str],
    means: list[float],
    stds: list[float],
    coefficients: dict[str, list[float]],
) -> dict[str, dict[str, dict[str, Any]]]:
    accumulators = {
        target: {
            subset: ErrorStats()
            for subset in ("train_fit", "temporal_holdout", "spatial_holdout_all", "spatiotemporal_holdout")
        }
        for target in TARGETS
    }
    for row in open_rows(path):
        timestamp = parse_timestamp(row["timestamp_utc"])
        subsets = subset_names(row["point_id"], timestamp, cutoff, spatial_holdout)
        x = features(row)
        for target in TARGETS:
            raw = numeric(row, f"raw_{target}")
            truth = numeric(row, f"target_{target}")
            corrected = raw + predict_residual(x, means, stds, coefficients[target])
            if target == "relative_humidity_2m":
                corrected = min(100.0, max(0.0, corrected))
            for subset in subsets:
                accumulators[target][subset].add(raw - truth, corrected - truth)
    return {
        target: {subset: values.result() for subset, values in subsets.items()}
        for target, subsets in accumulators.items()
    }


def promotion_gate(metrics: dict[str, dict[str, dict[str, Any]]], target: str) -> dict[str, Any]:
    required = ("temporal_holdout", "spatiotemporal_holdout")
    checks = {
        subset: metrics[target][subset].get("n", 0) >= 1000
        and (metrics[target][subset].get("mae_skill_percent") or 0) > 0
        for subset in required
    }
    return {
        "accepted_for_runtime": False,
        "research_gate_passed": all(checks.values()),
        "checks": checks,
        "note": "Runtime promotion requires separate operational forecast verification and safety review.",
    }


def write_model_card(
    path: Path,
    manifest: dict[str, Any],
    metrics: dict[str, Any],
    cutoff: datetime,
    spatial_holdout: set[str],
    terrain_sources: set[str],
) -> None:
    def metric_line(target: str, subset: str) -> str:
        item = metrics[target][subset]
        return (
            f"| {target} | {subset} | {item['n']:,} | {item['baseline_mae']:.4f} | "
            f"{item['corrected_mae']:.4f} | {item['mae_skill_percent']:.2f}% |"
        )

    lines = [
        "# Model card — Điện Biên weather residual correction",
        "",
        "> Trạng thái: **nghiên cứu offline, chưa kết nối runtime và không dùng để phát cảnh báo**.",
        "",
        "## Mục tiêu",
        "",
        "Mô hình ridge tuyến tính dự đoán residual giữa GFS Global và dữ liệu tham chiếu. "
        "Nó là proof-of-concept hậu xử lý tại các centroid xã, không phải mô hình dự báo thiên tai, "
        "không phải nội suy thời tiết 30 m và không thay thế bản tin cơ quan chuyên môn.",
        "",
        "## Dữ liệu và tách tập",
        "",
        f"- Khoảng dữ liệu: `{manifest['start_date']}` đến `{manifest['end_date']}`; {manifest['hourly_rows']:,} dòng giờ.",
        f"- Số điểm: {manifest['point_count']}; spatial holdout: {len(spatial_holdout)} điểm chưa xuất hiện khi fit.",
        f"- Temporal cutoff: `{cutoff.isoformat()}`; dữ liệu từ mốc này không dùng để fit.",
        f"- Terrain artifact dùng trong lần chạy này: `{', '.join(sorted(terrain_sources))}`.",
        "- Nhiệt độ/độ ẩm tham chiếu ERA5-Land; mưa/gió/cloud ERA5 chỉ để đối chiếu vì ERA5-Land không cung cấp các biến đó qua API.",
        "- `elevation=nan` và `cell_selection=nearest` được dùng để tắt statistical downscaling của provider ở input/target.",
        "",
        "## Kết quả",
        "",
        "| Biến | Tập | n | MAE GFS gốc | MAE hiệu chỉnh | Skill MAE |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for target in TARGETS:
        for subset in ("train_fit", "temporal_holdout", "spatial_holdout_all", "spatiotemporal_holdout"):
            lines.append(metric_line(target, subset))
    lines += [
        "",
        "## Giới hạn và safety gate",
        "",
        "- ERA5-Land là reanalysis/reference, không phải quan trắc trạm hay ground truth tuyệt đối.",
        "- Chưa có SRTM thì elevation fallback 90 m không có slope/aspect/TPI thật; các cột đó bằng 0.",
        "- Không đánh giá forecast lead-time: cần Previous Runs/Single Runs API trước khi tuyên bố cải thiện dự báo vận hành.",
        "- Artifact luôn ghi `accepted_for_runtime=false`; chỉ được tích hợp sau kiểm định mùa mưa, calibration và phê duyệt nghiệp vụ.",
        "- Cảnh báo production hiện vẫn dùng Open-Meteo multi-model và rule minh bạch, không dùng model này.",
        "",
        "## Tái lập",
        "",
        "Xem `research/weather_downscaling/README.md`. Dataset lớn và cache API không commit; manifest có SHA-256 để đối chiếu.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    point_ids, minimum, maximum, terrain_sources = scan_dataset(args.dataset)
    if args.temporal_cutoff:
        cutoff = parse_timestamp(args.temporal_cutoff)
    else:
        cutoff = minimum + (maximum - minimum) / 2
    if not minimum < cutoff <= maximum:
        raise ValueError("temporal-cutoff must fall inside the dataset range")
    spatial_holdout = select_spatial_holdout(point_ids, args.spatial_holdout_every)
    stats, coefficients, training_rows = fit_models(
        args.dataset, cutoff, spatial_holdout, args.ridge_alpha
    )
    stds = stats.standard_deviations()
    metrics = evaluate(args.dataset, cutoff, spatial_holdout, stats.mean, stds, coefficients)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))

    generated_at = datetime.now(timezone.utc).isoformat()
    gates = {target: promotion_gate(metrics, target) for target in TARGETS}
    model = {
        "schema_version": 1,
        "generated_at": generated_at,
        "purpose": "offline_research_only",
        "accepted_for_runtime": False,
        "dataset_sha256": sha256_file(args.dataset),
        "temporal_cutoff_utc": cutoff.isoformat(),
        "spatial_holdout_point_ids": sorted(spatial_holdout),
        "training_rows": training_rows,
        "ridge_alpha": args.ridge_alpha,
        "feature_names": FEATURE_NAMES,
        "feature_means": stats.mean,
        "feature_standard_deviations": stds,
        "models": {
            target: {
                "kind": "ridge_residual_correction",
                "intercept": coefficients[target][0],
                "coefficients": coefficients[target][1:],
                "prediction": f"corrected_{target} = raw_{target} + predicted_residual",
                "promotion_gate": gates[target],
            }
            for target in TARGETS
        },
    }
    metrics_payload = {
        "schema_version": 1,
        "generated_at": generated_at,
        "dataset_sha256": model["dataset_sha256"],
        "temporal_cutoff_utc": cutoff.isoformat(),
        "spatial_holdout_point_ids": sorted(spatial_holdout),
        "metrics": metrics,
        "promotion_gates": gates,
    }
    args.model_output.parent.mkdir(parents=True, exist_ok=True)
    args.model_output.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
    args.metrics_output.write_text(json.dumps(metrics_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_model_card(args.model_card, manifest, metrics, cutoff, spatial_holdout, terrain_sources)
    print(json.dumps(metrics_payload, ensure_ascii=False, indent=2))
    print(f"Wrote {args.model_output}, {args.metrics_output}, and {args.model_card}")


if __name__ == "__main__":
    main()
