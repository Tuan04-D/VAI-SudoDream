import base64
import logging
import time
import unicodedata
from typing import Literal

import edge_tts
import httpx

import config


def _strip_diacritics(text: str) -> str:
    """Vietnamese diacritics (e.g. in commune names like 'Mường Phăng') are
    outside the Hmong TTS model's character vocabulary and crash it with a
    500 on Kaggle. Hmong RPA is plain ASCII, so any residual Vietnamese
    proper nouns mixed into a Hmong sentence need to fall back to bare
    Latin letters instead."""
    text = text.replace("đ", "d").replace("Đ", "D")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c))

_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=30.0, pool=5.0)
_HEADERS = {
    "bypass-tunnel-reminder": "1",
    "ngrok-skip-browser-warning": "1",
    "User-Agent": "HmongBridge/1.0",
}
_log = logging.getLogger(__name__)

_http = httpx.AsyncClient(
    timeout=_TIMEOUT,
    headers=_HEADERS,
    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
)


class ModelClient:
    @property
    def base_url(self) -> str:
        return config.KAGGLE_NGROK_URL

    def _raise_with_detail(self, resp: httpx.Response):
        try:
            detail = resp.json().get("detail", resp.text[:300])
        except Exception:
            detail = resp.text[:300]
        raise httpx.HTTPStatusError(
            f"HTTP {resp.status_code}: {detail}",
            request=resp.request,
            response=resp,
        )

    async def transcribe(
        self,
        audio_bytes: bytes,
        language: Literal["hmong", "vietnamese"],
    ) -> dict:
        audio_b64 = base64.b64encode(audio_bytes).decode()
        t0 = time.time()
        resp = await _http.post(
            f"{self.base_url}/asr",
            json={"audio": audio_b64, "language": language},
        )
        if not resp.is_success:
            self._raise_with_detail(resp)
        data = resp.json()
        _log.info("[RTT] asr_%s: %.2fs | kaggle=%.0fms | text=%r",
                  language, time.time() - t0,
                  data.get("latency_ms", 0), (data.get("text") or "")[:40])
        return data

    async def synthesize(
        self,
        text: str,
        language: Literal["hmong", "vietnamese"],
    ) -> dict:
        if language == "vietnamese":
            return await self._viet_tts_local(text)

        text = _strip_diacritics(text)
        t0 = time.time()
        resp = await _http.post(
            f"{self.base_url}/tts",
            json={"text": text, "language": language},
        )
        if not resp.is_success:
            self._raise_with_detail(resp)
        data = resp.json()
        _log.info("[RTT] tts_%s: %.2fs | kaggle=%.0fms | chars=%d",
                  language, time.time() - t0,
                  data.get("latency_ms", 0), len(text))
        return {"audio": data["audio"], "fmt": "wav"}

    async def _viet_tts_local(self, text: str) -> dict:
        t0 = time.time()
        comm = edge_tts.Communicate(text, voice="vi-VN-HoaiMyNeural")
        chunks = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        audio_b64 = base64.b64encode(b"".join(chunks)).decode()
        _log.info("[LOCAL] tts_vietnamese: %.2fs | chars=%d", time.time() - t0, len(text))
        return {"audio": audio_b64, "fmt": "mp3"}

    async def warmup(self):
        try:
            await self._viet_tts_local("xin chào")
            _log.info("[WARMUP] edge-tts Vietnamese TTS ready")
        except Exception as e:
            _log.warning("[WARMUP] edge-tts warmup failed: %s", e)

    async def health(self) -> dict:
        resp = await _http.get(f"{self.base_url}/health")
        if not resp.is_success:
            self._raise_with_detail(resp)
        return resp.json()

    async def close(self):
        await _http.aclose()


model_client = ModelClient()
