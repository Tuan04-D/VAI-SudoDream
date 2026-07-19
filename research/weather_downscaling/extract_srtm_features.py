from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path

from common import DATA_DIR, DEFAULT_POINTS_PATH, load_points


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract static terrain features from a local SRTM GL1 GeoTIFF.")
    parser.add_argument("--dem", type=Path, required=True, help="Local, pre-downloaded SRTM GL1 30 m GeoTIFF")
    parser.add_argument("--points", type=Path, default=DEFAULT_POINTS_PATH)
    parser.add_argument("--output", type=Path, default=DATA_DIR / "terrain_features.csv")
    parser.add_argument("--window-radius", type=int, default=5, help="Neighbourhood radius in raster pixels")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        import numpy as np
        import rasterio
        from rasterio.windows import Window
    except ImportError as exc:
        raise SystemExit("Install optional terrain dependencies: pip install -r requirements-terrain.txt") from exc

    points = load_points(args.points, max_points=None)
    output_rows: list[dict[str, object]] = []
    with rasterio.open(args.dem) as dataset:
        if dataset.crs is None:
            raise ValueError("DEM has no CRS")
        from rasterio.warp import transform

        xs, ys = transform("EPSG:4326", dataset.crs, [point["lon"] for point in points], [point["lat"] for point in points])
        x_res, y_res = abs(dataset.transform.a), abs(dataset.transform.e)
        radius = max(2, args.window_radius)
        for point, x, y in zip(points, xs, ys):
            row_index, column_index = dataset.index(x, y)
            window = Window(column_index - radius, row_index - radius, 2 * radius + 1, 2 * radius + 1)
            values = dataset.read(1, window=window, boundless=True, masked=True).astype("float64")
            if values.mask.all():
                raise ValueError(f"No valid DEM cells around {point['name']}")
            filled = values.filled(np.nan)
            center = float(filled[radius, radius])
            if math.isnan(center):
                center = float(np.nanmedian(filled))
            gradient_y, gradient_x = np.gradient(filled, y_res, x_res)
            center_dx = float(gradient_x[radius, radius])
            center_dy = float(gradient_y[radius, radius])
            slope = math.degrees(math.atan(math.sqrt(center_dx**2 + center_dy**2)))
            aspect = (math.degrees(math.atan2(-center_dx, center_dy)) + 360) % 360
            neighbourhood_mean = float(np.nanmean(filled))
            tpi = center - neighbourhood_mean
            output_rows.append(
                {
                    "point_id": point["id"],
                    "point_name": point["name"],
                    "terrain_source": "srtm_gl1_30m",
                    "elevation_m": round(center, 3),
                    "slope_deg": round(slope, 4),
                    "aspect_deg": round(aspect, 4),
                    "tpi_m": round(tpi, 3),
                    "delta_h_m": round(center - neighbourhood_mean, 3),
                }
            )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)
    print(f"Wrote {len(output_rows)} terrain rows to {args.output}")


if __name__ == "__main__":
    main()

