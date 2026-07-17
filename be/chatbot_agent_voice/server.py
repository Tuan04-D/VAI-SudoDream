import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import llm
from model_client import model_client
from routers import chat, voice


@asynccontextmanager
async def lifespan(app: FastAPI):
    await model_client.warmup()
    yield
    await model_client.close()


app = FastAPI(title="Trạm Bản Chatbot Agent", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(voice.router)


class TTSRequest(BaseModel):
    text: str
    language: str


@app.get("/health")
async def health():
    kaggle_ok = False
    try:
        result = await model_client.health()
        kaggle_ok = result.get("status") == "ok"
    except Exception:
        kaggle_ok = False
    return {"status": "ok", "kaggle_server": kaggle_ok}


@app.post("/tts")
async def synthesize_text(request: TTSRequest):
    if request.language not in {"hmong", "vietnamese"}:
        raise HTTPException(status_code=400, detail="Language must be 'hmong' or 'vietnamese'")
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    clean_text = llm.preprocess_for_tts(request.text)
    t0 = time.time()
    try:
        result = await model_client.synthesize(clean_text or request.text[:400], request.language)
        return {"audio": result["audio"], "latency_ms": int((time.time() - t0) * 1000)}
    except Exception:
        raise HTTPException(status_code=503, detail="TTS service unavailable")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=config.PORT, reload=True)
