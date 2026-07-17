import os
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
KAGGLE_NGROK_URL = os.getenv("KAGGLE_NGROK_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", "8001"))
