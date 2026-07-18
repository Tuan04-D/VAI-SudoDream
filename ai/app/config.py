from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    openai_model: str
    landslide_refresh_hours: int
    http_timeout_seconds: float
    landslide_cache_path: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5.6").strip() or "gpt-5.6",
        landslide_refresh_hours=max(
            1, int(os.getenv("LANDSLIDE_REFRESH_HOURS", "6"))
        ),
        http_timeout_seconds=max(
            5.0, float(os.getenv("HTTP_TIMEOUT_SECONDS", "30"))
        ),
        landslide_cache_path=BASE_DIR / "data" / "landslide_dien_bien.json",
    )

