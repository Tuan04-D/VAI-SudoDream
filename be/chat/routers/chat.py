"""Chat endpoints.

Anonymous use remains stateless. Authenticated resident text turns are saved
under the identity from the bearer token; client-supplied resident IDs are
never trusted.
"""
import asyncio
import json as _json
import queue as _queue
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core import security as auth
from infrastructure import mongo as db
from .. import llm
from ..model_client import model_client

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class TextMessageRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)
    language: str = "vietnamese"
    context: dict | None = None


def _history_dicts(history: list[ChatMessage]) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in history]


def _sse(obj: dict) -> str:
    return f"data: {_json.dumps(obj, ensure_ascii=False)}\n\n"


def _run_stream_generator(gen_func, *args) -> tuple:
    q: _queue.Queue = _queue.Queue()
    _DONE = object()

    def _worker():
        try:
            for tok in gen_func(*args):
                q.put(tok)
        except Exception as exc:
            q.put(("__error__", str(exc)))
        finally:
            q.put(_DONE)

    import threading
    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    return q, _DONE


@router.post("/message/text")
async def chat_text_endpoint(
    request: TextMessageRequest,
    current_user: Annotated[dict | None, Depends(auth.get_optional_user)],
):
    if request.language not in ("vietnamese", "hmong"):
        raise HTTPException(status_code=400, detail="language must be 'vietnamese' or 'hmong'")
    response_text = await asyncio.to_thread(
        llm.chat_text, _history_dicts(request.history), request.message, request.language, request.context,
    )
    if current_user and current_user.get("role") == "resident":
        await db.add_chat_message(current_user["_id"], "user", request.message, request.language)
        await db.add_chat_message(current_user["_id"], "assistant", response_text, request.language)
    return {"content": response_text, "message_id": str(uuid.uuid4())}


@router.post("/message/text/stream")
async def chat_text_stream_endpoint(
    request: TextMessageRequest,
    current_user: Annotated[dict | None, Depends(auth.get_optional_user)],
):
    if request.language not in ("vietnamese", "hmong"):
        raise HTTPException(status_code=400, detail="language must be 'vietnamese' or 'hmong'")
    history = _history_dicts(request.history)
    resident_id = current_user["_id"] if current_user and current_user.get("role") == "resident" else None

    async def generate():
        q, DONE = _run_stream_generator(
            llm.chat_text_stream, history, request.message, request.language, request.context,
        )
        full_text = ""
        while True:
            try:
                item = q.get_nowait()
            except _queue.Empty:
                await asyncio.sleep(0.005)
                continue
            if item is DONE:
                break
            if isinstance(item, tuple) and item[0] == "__error__":
                yield _sse({"type": "error", "message": item[1]})
                return
            full_text += item
            yield _sse({"type": "token", "text": item})
        if resident_id:
            await db.add_chat_message(resident_id, "user", request.message, request.language)
            await db.add_chat_message(resident_id, "assistant", full_text, request.language)
        yield _sse({"type": "done", "message_id": str(uuid.uuid4())})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/message/speech")
async def chat_speech_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("hmong"),
    history: str = Form("[]"),
    context: str = Form("null"),
):
    import time

    if language not in ("vietnamese", "hmong"):
        raise HTTPException(status_code=400, detail="language must be 'vietnamese' or 'hmong'")

    try:
        history_list = _json.loads(history)
        context_obj = _json.loads(context)
    except _json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="history/context must be valid JSON")

    total_start = time.time()
    audio_bytes = await audio.read()

    t0 = time.time()
    asr_result = await model_client.transcribe(audio_bytes, language)
    asr_ms = int((time.time() - t0) * 1000)
    raw_text = asr_result["text"].strip()

    if not raw_text:
        raise HTTPException(status_code=422, detail="Could not transcribe audio — please speak clearly and try again")

    t0 = time.time()
    corrected_input, output_text = await asyncio.gather(
        asyncio.to_thread(llm.spell_correct, raw_text, language),
        asyncio.to_thread(llm.chat_speech, history_list, raw_text, language, context_obj),
    )
    llm_ms = int((time.time() - t0) * 1000)

    corrected_input = corrected_input or raw_text
    clean_text = llm.preprocess_for_tts(output_text) or output_text[:400]

    t0 = time.time()
    output_audio = None
    tts_ms = 0
    try:
        tts_result = await model_client.synthesize(clean_text, language)
        output_audio = tts_result["audio"]
        tts_ms = int((time.time() - t0) * 1000)
    except Exception:
        tts_ms = int((time.time() - t0) * 1000)

    total_ms = int((time.time() - total_start) * 1000)
    return {
        "input_text": corrected_input,
        "output_text": output_text,
        "output_audio": output_audio,
        "message_id": str(uuid.uuid4()),
        "latency_ms": {"asr": asr_ms, "llm": llm_ms, "tts": tts_ms, "total": total_ms},
    }
