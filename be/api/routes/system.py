"""System, commune, geography and speech endpoints."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import communes
from chat import llm as chat_llm
from chat.model_client import model_client
from core import config
from infrastructure import mongo


router = APIRouter(tags=["system"])


class TTSRequest(BaseModel):
    text: str
    language: str


@router.get("/health")
async def health():
    kaggle_ok = False
    if model_client.base_url:
        try:
            kaggle_ok = (await model_client.health()).get("status") == "ok"
        except Exception:
            pass
    mongo_ok = await mongo.ping()
    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongodb": mongo_ok,
        "communes": len(communes.COMMUNES),
        "llm_provider": config.LLM_PROVIDER,
        "llm_configured": bool(config.LLM_API_KEY),
        "kaggle_server": kaggle_ok,
    }


@router.post("/tts")
async def synthesize_text(payload: TTSRequest):
    if payload.language not in {"hmong", "vietnamese"}:
        raise HTTPException(status_code=400, detail="Unsupported language")
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    clean_text = chat_llm.preprocess_for_tts(payload.text)
    try:
        result = await model_client.synthesize(
            clean_text or payload.text[:400], payload.language
        )
        return {"audio": result["audio"]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="TTS service unavailable") from exc


@router.get("/api/communes")
async def list_communes():
    return {"default_commune_id": config.DEFAULT_COMMUNE_ID, "communes": communes.COMMUNES}


@router.get("/api/communes/{commune_id}")
async def get_commune(commune_id: str):
    commune = communes.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    return commune


@router.get("/api/geo/province")
async def geo_province():
    with open(communes.DATA_DIR / "dienbien_province.geojson", encoding="utf-8") as file:
        return json.load(file)


@router.get("/api/geo/communes")
async def geo_communes():
    with open(communes.DATA_DIR / "dienbien_communes.geojson", encoding="utf-8") as file:
        return json.load(file)
