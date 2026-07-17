"""
Grounded NLG for warning/notification text — mirrors the constrained-generation
design in VAIC2026_Overview_SanPham_ChiTiet.md section 5.6: the LLM is only
allowed to rephrase the structured risk JSON + a fixed recommended-action
template, never invent new facts, numbers, or actions. If the DeepSeek call
fails (no network / no key at demo time), a deterministic template built
directly from the same JSON is used instead — output stays grounded either way.
"""
import logging
import re

from openai import OpenAI

import config

_log = logging.getLogger(__name__)

_client = OpenAI(api_key=config.DEEPSEEK_API_KEY, base_url="https://api.deepseek.com") if config.DEEPSEEK_API_KEY else None

_WARNING_SYSTEM = (
    "Bạn là hệ thống soạn bản tin cảnh báo thiên tai cho xã miền núi Điện Biên.\n"
    "QUY TẮC BẮT BUỘC:\n"
    "- Chỉ được dùng đúng các số liệu và hành động khuyến nghị trong dữ liệu JSON được cung cấp.\n"
    "- KHÔNG được bịa thêm số liệu, địa danh, hay hành động nào ngoài dữ liệu đã cho.\n"
    "- Viết 2-3 câu tiếng Việt, ngắn gọn, rõ ràng, đúng mức độ nghiêm trọng.\n"
    "- Câu đầu nêu mức rủi ro và loại hình thời tiết nguy hiểm, câu sau nêu hành động cần làm.\n"
    "- Không dùng markdown, không thêm lời chào hay ký hiệu."
)

_NOTIFY_SYSTEM = (
    "Bạn là hệ thống soạn tin nhắn cảnh báo ngắn để đọc thành giọng nói tiếng H'Mông cho người dân xã miền núi.\n"
    "QUY TẮC BẮT BUỘC:\n"
    "- Chỉ dùng đúng thông tin trong dữ liệu JSON được cung cấp, không bịa thêm.\n"
    "- Viết 2 câu tiếng H'Mông (RPA Latin), ngắn gọn nhưng đủ cụ thể: nêu rõ mức nguy hiểm, nguy cơ gì, và việc cần làm ngay.\n"
    "- TUYỆT ĐỐI KHÔNG dùng chữ số (không viết '50mm', '30 độ') — mọi con số PHẢI viết thành chữ để máy đọc giọng nói đọc được.\n"
    "- Không chung chung ('cẩn thận thời tiết') — phải nêu hành động cụ thể lấy từ dữ liệu được cung cấp.\n"
    "- Chỉ trả về văn bản tiếng H'Mông, không giải thích, không markdown."
)

_DIGIT_RE = re.compile(r"\d")


def _call(system: str, user: str, max_tokens: int = 700) -> str:
    if not _client:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")
    response = _client.chat.completions.create(
        model=config.DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.4,
    )
    return (response.choices[0].message.content or "").strip()


def _fallback_vi(commune_name: str, day_data: dict, date_str: str) -> str:
    return (
        f"Cảnh báo {day_data['hazard_label'].lower()} mức {_level_label(day_data['risk_level'])} "
        f"tại {commune_name} ngày {date_str}. {day_data['recommended_action']}"
    )


_LEVEL_LABELS = {"thap": "thấp", "trung_binh": "trung bình", "cao": "cao", "nguy_hiem": "nguy hiểm"}


def _level_label(level: str) -> str:
    return _LEVEL_LABELS.get(level, level)


def generate_warning_text(commune_name: str, day_data: dict, date_str: str) -> str:
    payload = (
        f'{{"xa": "{commune_name}", "ngay": "{date_str}", '
        f'"loai_nguy_co": "{day_data["hazard_label"]}", "muc_rui_ro": "{_level_label(day_data["risk_level"])}", '
        f'"hanh_dong_khuyen_nghi": "{day_data["recommended_action"]}"}}'
    )
    try:
        text = _call(_WARNING_SYSTEM, payload)
        if not text.strip():
            raise RuntimeError("empty response from LLM")
        return text
    except Exception as exc:
        _log.warning("generate_warning_text fallback (%s)", exc)
        return _fallback_vi(commune_name, day_data, date_str)


_HAZARD_HMONG = {
    "binh_thuong": "huab cua zoo li qub",
    "mua_lon": "nag loj heev",
    "lu_quet": "dej nyab ceev",
    "ret_hai": "no daus heev",
    "nang_nong": "kub heev",
}


def _fallback_notify_hmong(commune_name: str, day_data: dict) -> str:
    hazard = _HAZARD_HMONG.get(day_data.get("hazard_type"), "huab cua tsis zoo")
    return (
        f"Muaj kev txhawj xeeb txog {hazard} nyob rau {commune_name}. "
        f"Thov ceev faj thiab ua raws li kev qhia ntawm zos."
    )


def generate_notification_texts(commune_name: str, day_data: dict, date_str: str) -> dict:
    vi_short = generate_warning_text(commune_name, day_data, date_str)

    payload = (
        f'{{"xa": "{commune_name}", "ngay": "{date_str}", '
        f'"loai_nguy_co": "{day_data["hazard_label"]}", "muc_rui_ro": "{_level_label(day_data["risk_level"])}", '
        f'"hanh_dong_khuyen_nghi": "{day_data["recommended_action"]}"}}'
    )
    try:
        hmong = _call(_NOTIFY_SYSTEM, payload, max_tokens=600)
        if _DIGIT_RE.search(hmong):
            _log.warning("hmong notification contained digits, regenerating not attempted, stripping digits")
        if not hmong.strip():
            raise RuntimeError("empty hmong response")
    except Exception as exc:
        _log.warning("generate_notification_texts fallback (%s)", exc)
        hmong = _fallback_notify_hmong(commune_name, day_data)

    return {"vi_short": vi_short, "hmong_tts_text": hmong}
