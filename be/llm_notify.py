"""
VI → Hmong translation for TTS, via the shared LLM provider (llm_provider.py).

The Vietnamese source text is now always real: either weather_ai's own
LLM-written bulletin, or forecast_service.py's deterministic fallback built
straight from real weather/landslide numbers when no bulletin is available.
This module's only job is turning that Vietnamese text into Hmong that's
safe to feed to the Hmong TTS model — numbers spelled out as words, since
the TTS model's character set doesn't include digits or Vietnamese
diacritics reliably (see chat/model_client.py's _strip_diacritics for the
matching TTS-side fix).
"""
import logging

import llm_provider

_log = logging.getLogger(__name__)

_TRANSLATE_SYSTEM = (
    "Bạn dịch bản tin cảnh báo thời tiết từ tiếng Việt sang tiếng H'Mông (RPA Latin) "
    "để đọc thành giọng nói cho người dân xã miền núi Điện Biên.\n"
    "QUY TẮC BẮT BUỘC:\n"
    "- Dịch đúng nội dung, không thêm hay bớt thông tin so với văn bản gốc.\n"
    "- TUYỆT ĐỐI KHÔNG dùng chữ số (không viết '50mm', '30 độ') — mọi con số PHẢI viết thành chữ.\n"
    "- Giữ ngắn gọn, 2-3 câu, dễ nghe qua loa.\n"
    "- Chỉ trả về văn bản tiếng H'Mông, không giải thích, không markdown."
)


def _call(system: str, user: str, max_tokens: int = 2000) -> str:
    if not llm_provider.is_configured():
        raise RuntimeError("LLM_API_KEY not configured")
    response = llm_provider.get_client().chat.completions.create(
        model=llm_provider.get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return (response.choices[0].message.content or "").strip()


_FALLBACK_HMONG = (
    "Muaj lus ceeb toom txog huab cua tsis zoo nyob rau hauv zos. "
    "Thov ceev faj thiab mloog raws li kev qhia ntawm zos."
)


def translate_to_hmong_tts(vi_text: str) -> str:
    if not vi_text or not vi_text.strip():
        return _FALLBACK_HMONG
    try:
        hmong = _call(_TRANSLATE_SYSTEM, vi_text)
        if not hmong.strip():
            raise RuntimeError("empty hmong response")
        return hmong
    except Exception as exc:
        _log.warning("translate_to_hmong_tts fallback (%s)", exc)
        return _FALLBACK_HMONG
