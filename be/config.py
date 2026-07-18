import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- LLM (shared by chat, Hmong translation, and the weather advisory bulletin) ---
# LLM_PROVIDER picks both the API base_url and the default model — see llm_provider.py.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "DEEPSEEK").strip().upper()
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()

# --- Kaggle model server (ASR/TTS for Hmong + Vietnamese voice) ---
KAGGLE_NGROK_URL = os.getenv("KAGGLE_NGROK_URL", "").rstrip("/")

# --- Commune / notification defaults ---
DEFAULT_COMMUNE_ID = os.getenv("DEFAULT_COMMUNE_ID", "19571213")
NOTIFY_HOUR = int(os.getenv("NOTIFY_HOUR", "7"))
NOTIFY_MINUTE = int(os.getenv("NOTIFY_MINUTE", "0"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

FORECAST_DAYS = 5
WEATHER_CACHE_MINUTES = int(os.getenv("WEATHER_CACHE_MINUTES", "30"))
LANDSLIDE_CACHE_MINUTES = int(os.getenv("LANDSLIDE_CACHE_MINUTES", "10"))
ADVISORY_CACHE_MINUTES = int(os.getenv("ADVISORY_CACHE_MINUTES", "20"))

# --- weather_ai (real Open-Meteo + NCHMF data, formerly the standalone fe/ai service) ---
LANDSLIDE_REFRESH_HOURS = max(1, int(os.getenv("LANDSLIDE_REFRESH_HOURS", "6")))
HTTP_TIMEOUT_SECONDS = max(5.0, float(os.getenv("HTTP_TIMEOUT_SECONDS", "30")))
LANDSLIDE_CACHE_PATH = Path(__file__).parent / "data" / "landslide_dien_bien.json"
