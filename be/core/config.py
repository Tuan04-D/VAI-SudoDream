import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()
IS_VERCEL = bool(os.getenv("VERCEL"))
_cache_dir = os.getenv("CACHE_DIR", "").strip()
CACHE_DIR = Path(_cache_dir) if _cache_dir else Path("/tmp/tramban") if IS_VERCEL else BACKEND_DIR / "data"
SCHEDULER_ENABLED = os.getenv(
    "SCHEDULER_ENABLED", "false" if IS_VERCEL else "true"
).strip().lower() in {"1", "true", "yes", "on"}
WARMUP_ENABLED = os.getenv(
    "WARMUP_ENABLED", "false" if IS_VERCEL else "true"
).strip().lower() in {"1", "true", "yes", "on"}

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

# --- MongoDB / authentication ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017").strip()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "tramban").strip() or "tramban"
MONGO_CONNECT_TIMEOUT_MS = max(1_000, int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "5000")))

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = max(5, int(os.getenv("ACCESS_TOKEN_MINUTES", "20")))
REFRESH_TOKEN_DAYS = max(1, int(os.getenv("REFRESH_TOKEN_DAYS", "30")))
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "tramban_refresh").strip() or "tramban_refresh"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() in {"1", "true", "yes", "on"}
ALLOW_OFFICIAL_SELF_REGISTRATION = os.getenv(
    "ALLOW_OFFICIAL_SELF_REGISTRATION", "false"
).strip().lower() in {"1", "true", "yes", "on"}

# Optional one-time bootstrap. The password is read from env and never persisted
# outside its Argon2 hash. Leave blank after the first administrator is created.
BOOTSTRAP_ADMIN_PHONE = os.getenv("BOOTSTRAP_ADMIN_PHONE", "").strip()
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
BOOTSTRAP_ADMIN_DISPLAY_NAME = os.getenv("BOOTSTRAP_ADMIN_DISPLAY_NAME", "Quản trị hệ thống").strip()

# --- durable SMS outbox ---
SMS_ENABLED = os.getenv("SMS_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
SMS_SERVICE_URL = os.getenv(
    "SMS_SERVICE_URL", "http://127.0.0.1:8001/api/v1/delivery/sms"
).strip()
SMS_DELIVERY_API_KEY = os.getenv("SMS_DELIVERY_API_KEY", "").strip()
SMS_MAX_ATTEMPTS = max(1, int(os.getenv("SMS_MAX_ATTEMPTS", "5")))
SMS_WORKER_SECONDS = max(10, int(os.getenv("SMS_WORKER_SECONDS", "30")))

FORECAST_DAYS = 5
WEATHER_CACHE_MINUTES = int(os.getenv("WEATHER_CACHE_MINUTES", "30"))
LANDSLIDE_CACHE_MINUTES = int(os.getenv("LANDSLIDE_CACHE_MINUTES", "10"))
ADVISORY_CACHE_MINUTES = int(os.getenv("ADVISORY_CACHE_MINUTES", "20"))

# --- weather_ai (real Open-Meteo + NCHMF data, formerly the standalone fe/ai service) ---
LANDSLIDE_REFRESH_HOURS = max(1, int(os.getenv("LANDSLIDE_REFRESH_HOURS", "6")))
HTTP_TIMEOUT_SECONDS = max(5.0, float(os.getenv("HTTP_TIMEOUT_SECONDS", "30")))
LANDSLIDE_CACHE_PATH = CACHE_DIR / "landslide_dien_bien.json"
