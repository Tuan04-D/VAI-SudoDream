"""
WebSocket voice pipeline for Trạm Bản's grounded weather Q&A voice chat.

Architecture (per turn), unchanged from the original agent-voice project for
latency reasons:
  [Client VAD] → speech blob → WS → [ASR] → [LLM stream] → [sentence TTS] → audio chunks → WS → [Client AudioQueue]

Key features:
  - Persistent WebSocket connection (no HTTP overhead per turn)
  - Sentence-level TTS: TTS starts per sentence, not after full LLM response
  - Interrupt/barge-in: client sends {type:"interrupt"} while AI is speaking
  - Ordered audio: sentences played in generation order regardless of TTS speed
  - No login: conversation history lives only for the lifetime of the socket.
"""
import asyncio
import base64
import logging
import queue
import re
import threading
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import llm
from model_client import model_client

_log = logging.getLogger(__name__)

router = APIRouter(tags=["voice"])

_SENT_RE = re.compile(r"(?<=[.!?。!?])\s*")
_MIN_TTS_CHARS = 6


def _split_sentences(text: str) -> tuple[list[str], str]:
    parts = _SENT_RE.split(text)
    if len(parts) <= 1:
        return [], text
    complete = [p.strip() for p in parts[:-1] if p.strip()]
    remainder = parts[-1]
    return complete, remainder


class _StopEvent:
    """Thread-safe stop flag used to cancel in-progress pipeline."""
    def __init__(self):
        self._flag = threading.Event()

    def set(self):
        self._flag.set()

    def clear(self):
        self._flag.clear()

    def is_set(self):
        return self._flag.is_set()


class ConvoPipeline:
    """Manages one grounded voice conversation over a WebSocket (no persistence)."""

    def __init__(self, ws: WebSocket, language: str, context: Optional[dict]):
        self.ws = ws
        self.language = language
        self.context = context
        self.history: list[dict] = []
        self._stop = _StopEvent()
        self._turn_lock = asyncio.Lock()

    async def cancel_turn(self):
        self._stop.set()
        async with self._turn_lock:
            pass
        self._stop.clear()

    async def run_turn(self, audio_bytes: bytes):
        async with self._turn_lock:
            await self._do_turn(audio_bytes)

    async def _do_turn(self, audio_bytes: bytes):
        import time as _time
        ws = self.ws
        stop = self._stop

        await _send(ws, {"type": "status", "stage": "asr"})
        t0 = _time.time()
        try:
            asr = await model_client.transcribe(audio_bytes, self.language)
        except Exception as e:
            await _send(ws, {"type": "error", "message": f"ASR failed: {e}"})
            return
        _log.info("[LATENCY] convo_asr_rtt: %.2fs", _time.time() - t0)

        raw_text = (asr.get("text") or "").strip()
        if not raw_text:
            await _send(ws, {"type": "skip", "reason": "empty_transcription"})
            return

        await _send(ws, {"type": "asr", "text": raw_text})
        if stop.is_set():
            return

        spell_task = asyncio.create_task(
            asyncio.to_thread(llm.spell_correct, raw_text, self.language)
        )

        tok_q: queue.Queue = queue.Queue()
        _DONE = object()
        t_llm_start = _time.time()
        t_first_token = [None]
        history_snapshot = list(self.history)

        def _llm_worker():
            try:
                for tok in llm.chat_speech_stream(history_snapshot, raw_text, self.language, self.context):
                    if stop.is_set():
                        break
                    if t_first_token[0] is None:
                        t_first_token[0] = _time.time()
                    tok_q.put(tok)
            finally:
                tok_q.put(_DONE)

        threading.Thread(target=_llm_worker, daemon=True).start()

        buf = ""
        full_text = ""
        tts_futures: list[asyncio.Future] = []

        while not stop.is_set():
            try:
                tok = tok_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.005)
                continue

            if tok is _DONE:
                if buf.strip() and len(buf.strip()) >= _MIN_TTS_CHARS:
                    tts_futures.append(asyncio.create_task(
                        _tts(self.language, buf.strip(), stop)
                    ))
                break

            full_text += tok
            buf += tok
            await _send(ws, {"type": "token", "text": tok})

            sentences, buf = _split_sentences(buf)
            for sent in sentences:
                if len(sent) >= _MIN_TTS_CHARS:
                    tts_futures.append(asyncio.create_task(
                        _tts(self.language, sent, stop)
                    ))

        if t_first_token[0]:
            _log.info("[LATENCY] convo_llm_ttft: %.2fs | total_llm: %.2fs",
                      t_first_token[0] - t_llm_start, _time.time() - t_llm_start)
        else:
            _log.warning("[LATENCY] convo_llm: no tokens received in %.2fs", _time.time() - t_llm_start)

        for fut in tts_futures:
            if stop.is_set():
                fut.cancel()
                continue
            try:
                tts_res = await fut
                if tts_res and not stop.is_set():
                    await _send(ws, {"type": "audio", "data": tts_res["audio"], "fmt": tts_res["fmt"]})
            except Exception:
                pass

        if full_text and not stop.is_set():
            try:
                corrected = await asyncio.wait_for(spell_task, timeout=5.0)
                corrected = corrected or raw_text
            except Exception:
                corrected = raw_text
            self.history.append({"role": "user", "content": corrected})
            self.history.append({"role": "assistant", "content": full_text})
            self.history = self.history[-20:]

        if not stop.is_set():
            await _send(ws, {"type": "turn_done"})


async def _send(ws: WebSocket, obj: dict):
    try:
        await ws.send_json(obj)
    except Exception:
        pass


async def _tts(language: str, text: str, stop: _StopEvent) -> Optional[dict]:
    import time as _time
    if stop.is_set() or not text.strip():
        return None
    try:
        t0 = _time.time()
        result = await model_client.synthesize(text, language)
        _log.info("[LATENCY] tts_%s: %.2fs | chars=%d", language, _time.time() - t0, len(text))
        audio = result.get("audio")
        return {"audio": audio, "fmt": result.get("fmt", "wav")} if audio else None
    except Exception:
        return None


@router.websocket("/ws/convo")
async def ws_convo(ws: WebSocket):
    """
    Persistent WebSocket for grounded voice conversation.

    Client sends:
      {type:"config", language:"vietnamese"|"hmong", context:{...}|null}
      {type:"speech_end", audio:"<base64 WAV>"}
      {type:"interrupt"}
      {type:"ping"}

    Server sends:
      {type:"ready"}
      {type:"status", stage:"asr"}
      {type:"asr", text}
      {type:"token", text}
      {type:"audio", data:"<base64 WAV>"}
      {type:"turn_done"}
      {type:"interrupted"}
      {type:"skip", reason}
      {type:"error", message}
      {type:"pong"}
    """
    await ws.accept()

    try:
        cfg = await asyncio.wait_for(ws.receive_json(), timeout=10.0)
    except Exception:
        await _send(ws, {"type": "error", "message": "Expected config frame"})
        await ws.close(code=4002)
        return

    language = cfg.get("language", "hmong")
    if language not in ("vietnamese", "hmong"):
        language = "hmong"
    context = cfg.get("context")

    await _send(ws, {"type": "ready"})

    pipeline = ConvoPipeline(ws, language, context)
    active_task: Optional[asyncio.Task] = None

    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")

            if kind == "speech_end":
                if active_task and not active_task.done():
                    await pipeline.cancel_turn()
                    try:
                        await asyncio.wait_for(active_task, timeout=1.0)
                    except Exception:
                        pass

                audio_b64 = msg.get("audio", "")
                if not audio_b64:
                    continue
                audio_bytes = base64.b64decode(audio_b64)
                active_task = asyncio.create_task(pipeline.run_turn(audio_bytes))

            elif kind == "interrupt":
                await pipeline.cancel_turn()
                if active_task and not active_task.done():
                    try:
                        await asyncio.wait_for(active_task, timeout=0.5)
                    except Exception:
                        pass
                await _send(ws, {"type": "interrupted"})

            elif kind == "ping":
                await _send(ws, {"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        _log.error("ws_convo unhandled error: %s", exc, exc_info=True)
    finally:
        await pipeline.cancel_turn()
