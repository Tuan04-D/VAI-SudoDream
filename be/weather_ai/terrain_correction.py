"""
Terrain (elevation) temperature correction — coefficients fitted offline via
scripts/train_terrain_correction.py on all 45 Điện Biên communes (36 for
fitting, 9 held out entirely as a spatial test set never seen during
fitting), evaluated against ERA5-Land as ground truth:

    TRAIN MAE  raw=0.654°C -> corrected=0.598°C  (8.6% better)
    TEST  MAE  raw=0.759°C -> corrected=0.681°C  (10.3% better, held-out communes)

residual(elevation, month) = intercept + elevation_coef * elevation
                              + month_sin_coef * sin(2*pi*month/12)
                              + month_cos_coef * cos(2*pi*month/12)

Open-Meteo already applies its own generic global lapse-rate adjustment to
whatever exact coordinate is queried (confirmed empirically — see review
notes), so this model is NOT "adding elevation awareness that doesn't
exist elsewhere". What it contributes is the LOCAL residual pattern specific
to Điện Biên's terrain (learned from real ERA5-Land ground truth) on top of
that generic correction — hence it is applied as a DELTA between two
elevations sharing the same base Open-Meteo call, not added to a raw value
directly.
"""
from __future__ import annotations

import math

INTERCEPT = 0.31893
ELEVATION_COEF = -0.000195
MONTH_SIN_COEF = 0.47130
MONTH_COS_COEF = 0.13294


def _residual(elevation_m: float, month: int) -> float:
    angle = 2 * math.pi * month / 12
    return (
        INTERCEPT
        + ELEVATION_COEF * elevation_m
        + MONTH_SIN_COEF * math.sin(angle)
        + MONTH_COS_COEF * math.cos(angle)
    )


def corrected_temperature(
    raw_temp_c: float, point_elevation_m: float, reference_elevation_m: float, month: int
) -> float:
    """raw_temp_c is Open-Meteo's value already fetched at a reference point
    (typically a commune centroid, cached). Returns the corrected value for a
    different point (resident coordinate, map grid cell) at a possibly
    different elevation but the same base forecast call."""
    delta = _residual(point_elevation_m, month) - _residual(reference_elevation_m, month)
    return round(raw_temp_c + delta, 2)
