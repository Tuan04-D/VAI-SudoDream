"""Static commune registry — the 45 xã/phường of Điện Biên (post-2025 merger),
loaded from the OpenStreetMap-derived GeoJSON in data/. Not mock: these are
real administrative boundaries and centroids (see data/README context in
NOTES.md for how they were fetched).
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

with open(DATA_DIR / "dienbien_communes_meta.json", encoding="utf-8") as f:
    COMMUNES = json.load(f)

COMMUNES_BY_ID = {c["id"]: c for c in COMMUNES}

DEFAULT_COMMUNE_ID = "19571213"  # Xã Mường Phăng — used as the demo "home" commune
