import os
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
CHATBOT_API_BASE = os.getenv("CHATBOT_API_BASE", "http://localhost:8001").rstrip("/")
DEFAULT_COMMUNE_ID = os.getenv("DEFAULT_COMMUNE_ID", "19571213")
NOTIFY_HOUR = int(os.getenv("NOTIFY_HOUR", "7"))
NOTIFY_MINUTE = int(os.getenv("NOTIFY_MINUTE", "0"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
