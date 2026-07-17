"""
MOCK DATA MODULE — stands in for the real downscaling + conformal-prediction risk
pipeline described in VAIC2026_Overview_SanPham_ChiTiet.md section 5.

There is no trained XGBoost downscaling model or conformal calibration in this
repo yet. Every number here is deterministically generated (seeded by commune id
+ day) so the UI has stable, demo-able data shaped exactly like the real model's
future output (see kỹ thuật.md section 4.2 for the target JSON shape). Swap
`generate_forecast()` for a real inference call once the ML pipeline exists —
the API layer (server.py) does not need to change.
"""
import hashlib
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

with open(DATA_DIR / "dienbien_communes_meta.json", encoding="utf-8") as f:
    COMMUNES = json.load(f)

COMMUNES_BY_ID = {c["id"]: c for c in COMMUNES}

DEFAULT_COMMUNE_ID = "19571213"  # Xã Mường Phăng — used as the demo "home" commune

HAZARD_LABELS = {
    "binh_thuong": "Thời tiết bình thường",
    "mua_lon": "Mưa lớn",
    "lu_quet": "Nguy cơ lũ quét",
    "ret_hai": "Rét hại / sương giá",
    "nang_nong": "Nắng nóng",
}

RECOMMENDED_ACTIONS = {
    "lu_quet": {
        "cao": "Theo dõi sát mực nước suối, chuẩn bị di dời vật nuôi và đồ đạc lên nơi cao.",
        "nguy_hiem": "Di dời khỏi khu vực trũng thấp và ven suối ngay, tuyệt đối không qua suối khi nước dâng, nghe loa xã.",
    },
    "mua_lon": {
        "cao": "Hạn chế đi lại qua ngầm tràn, che chắn chuồng trại và mùa vụ đang thu hoạch.",
        "nguy_hiem": "Không di chuyển qua khu vực sạt lở, sơ tán nếu cán bộ xã yêu cầu, giữ liên lạc với hàng xóm.",
    },
    "ret_hai": {
        "cao": "Che chắn chuồng trại, giữ ấm cho trâu bò, không thả rông gia súc ban đêm.",
        "nguy_hiem": "Đưa gia súc về chuồng kín gió, dự trữ thức ăn, hạn chế trẻ nhỏ và người già ra ngoài sớm.",
    },
    "nang_nong": {
        "cao": "Tưới nước cho cây trồng vào sáng sớm hoặc chiều muộn, đảm bảo đủ nước uống cho vật nuôi.",
        "nguy_hiem": "Tránh làm việc ngoài trời giữa trưa, bổ sung nước thường xuyên, theo dõi sức khỏe người già và trẻ nhỏ.",
    },
    "binh_thuong": {
        "cao": "Tiếp tục theo dõi bản tin hàng ngày.",
        "nguy_hiem": "Tiếp tục theo dõi bản tin hàng ngày.",
    },
}

_STORYLINE = {
    DEFAULT_COMMUNE_ID: ["trung_binh", "cao", "nguy_hiem", "cao", "thap"],
}
_STORYLINE_HAZARD = {DEFAULT_COMMUNE_ID: "lu_quet"}


def _seed(commune_id: str, day: int, salt: str = "") -> float:
    h = hashlib.md5(f"{commune_id}:{day}:{salt}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _risk_level(score: float) -> str:
    if score < 0.20:
        return "thap"
    if score < 0.50:
        return "trung_binh"
    if score < 0.75:
        return "cao"
    return "nguy_hiem"


_LEVEL_RANGE = {
    "thap": (0.05, 0.19),
    "trung_binh": (0.20, 0.49),
    "cao": (0.50, 0.74),
    "nguy_hiem": (0.75, 0.93),
}

_HAZARD_POOL = ["binh_thuong", "binh_thuong", "binh_thuong", "mua_lon", "lu_quet", "ret_hai"]


def _pick_hazard(commune_id: str, day: int, risk_level: str) -> str:
    if commune_id in _STORYLINE_HAZARD and risk_level in ("cao", "nguy_hiem"):
        return _STORYLINE_HAZARD[commune_id]
    if risk_level in ("thap",):
        return "binh_thuong"
    idx = int(_seed(commune_id, day, "hazard") * len(_HAZARD_POOL))
    hazard = _HAZARD_POOL[min(idx, len(_HAZARD_POOL) - 1)]
    if risk_level == "trung_binh" and hazard in ("lu_quet",):
        hazard = "mua_lon"
    return hazard


def _day_values(commune: dict, day: int) -> dict:
    commune_id = commune["id"]

    if commune_id in _STORYLINE and day <= len(_STORYLINE[commune_id]):
        level = _STORYLINE[commune_id][day - 1]
        lo, hi = _LEVEL_RANGE[level]
        risk_score = round(lo + _seed(commune_id, day, "score") * (hi - lo), 2)
    else:
        risk_score = round(_seed(commune_id, day, "score") * 0.55, 2)
        level = _risk_level(risk_score)

    hazard = _pick_hazard(commune_id, day, level)

    # Mid-July Điện Biên climate baseline: warm, rainy season.
    lat_factor = (commune["lat"] - 21.0) * 1.4  # rough north = slightly cooler
    base_temp = 29.5 - lat_factor - day * 0.15
    temp_noise = (_seed(commune_id, day, "temp") - 0.5) * 3.0
    temp_raw = round(base_temp + temp_noise, 1)

    base_precip = 8 + risk_score * 70
    precip_noise = _seed(commune_id, day, "precip") * 12
    precip_raw = round(max(0.0, base_precip + precip_noise - 10), 1)

    delta_h = round((_seed(commune_id, day, "delta_h") - 0.5) * 900, 0)
    temp_residual = round((_seed(commune_id, day, "dtemp") - 0.5) * 3.0 - delta_h / 700, 1)
    precip_residual = round(risk_score * 18 + _seed(commune_id, day, "dprecip") * 8, 1)

    temp_downscaled = round(temp_raw + temp_residual, 1)
    precip_downscaled = round(max(0.0, precip_raw + precip_residual), 1)

    q_precip = round(4 + risk_score * 6, 1)
    confidence = round(max(0.35, 1 - (q_precip / max(precip_downscaled, 1)) * 0.5), 2)

    return {
        "temp_raw": temp_raw,
        "temp_downscaled": temp_downscaled,
        "precip_raw": precip_raw,
        "precip_downscaled": precip_downscaled,
        "precip_pi_90": [
            round(max(0.0, precip_downscaled - q_precip), 1),
            round(precip_downscaled + q_precip, 1),
        ],
        "risk_score": risk_score,
        "risk_level": level,
        "confidence": confidence,
        "hazard_type": hazard,
        "hazard_label": HAZARD_LABELS[hazard],
        "recommended_action": RECOMMENDED_ACTIONS[hazard].get(
            level, "Tiếp tục theo dõi bản tin hàng ngày."
        ) if level in ("cao", "nguy_hiem") else "Thời tiết ổn định, tiếp tục theo dõi bản tin hàng ngày.",
    }


def generate_forecast(commune_id: str, days: int = 5) -> list[dict]:
    commune = COMMUNES_BY_ID.get(commune_id)
    if not commune:
        return []
    out = []
    for day in range(1, days + 1):
        values = _day_values(commune, day)
        out.append({"day_index": day, **values})
    return out


def generate_map_day(day: int) -> list[dict]:
    """One risk/temp/precip value per commune for a given day — feeds the choropleth."""
    out = []
    for commune in COMMUNES:
        values = _day_values(commune, day)
        out.append({
            "commune_id": commune["id"],
            "name": commune["name"],
            "lat": commune["lat"],
            "lon": commune["lon"],
            **values,
        })
    return out


def top_risk_communes(day: int = 1, limit: int = 4) -> list[dict]:
    ranked = sorted(generate_map_day(day), key=lambda c: c["risk_score"], reverse=True)
    return ranked[:limit]
