import logging
import re
import time
from openai import OpenAI
import config

_log = logging.getLogger(__name__)

_client = OpenAI(api_key=config.DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

# deepseek-v4-flash is a reasoning model — it spends part of max_tokens on hidden
# reasoning_content before writing the visible answer. Keep this generous or
# short replies silently come back empty.
_DEFAULT_MAX_TOKENS = 700

_SCOPE_RULES_VI = (
    "PHẠM VI HỖ TRỢ: dự báo/rủi ro thời tiết của xã trong dữ liệu bên dưới, mùa vụ và chăm sóc "
    "cây trồng vật nuôi bị ảnh hưởng bởi thời tiết đó, và các việc cần làm để phòng tránh thiên tai.\n"
    "QUY TẮC BẮT BUỘC (chống ảo giác):\n"
    "- CHỈ được dùng đúng số liệu trong khối DỮ LIỆU DỰ BÁO bên dưới. Tuyệt đối không tự bịa thêm "
    "nhiệt độ, lượng mưa, ngày, hay mức rủi ro nào không có trong dữ liệu.\n"
    "- Nếu người dùng hỏi về ngày hoặc địa điểm không có trong dữ liệu, nói rõ là chưa có dữ liệu, "
    "không đoán.\n"
    "- Nếu câu hỏi NẰM NGOÀI phạm vi hỗ trợ (ví dụ: y tế khẩn cấp, chuyện không liên quan thời tiết/mùa vụ), "
    "trả lời NGẮN GỌN rằng câu hỏi ngoài phạm vi hỗ trợ của trợ lý này, nêu cụ thể trợ lý hỗ trợ được gì, "
    "không trả lời nội dung ngoài phạm vi đó."
)

_SCOPE_RULES_HMONG = (
    "QHOV KWS PAB TAU: xov xwm huab cua thiab kev txhawj xeeb ntawm zos hauv cov ntaub ntawv hauv qab no, "
    "kev ua liaj ua teb thiab yug tsiaj raws li huab cua, thiab yam yuav tsum ua kom tiv thaiv xwm ceev.\n"
    "COV CAI TSUM UA (tiv thaiv kev hais tsis muaj tseeb):\n"
    "- TSUM siv tib cov nab npawb hauv COV NTAUB NTAWV XWM HUAB CUA hauv qab no xwb. Txhob hais txog "
    "kub thiab txias, nag, los sis hnub twg uas tsis muaj hauv cov ntaub ntawv.\n"
    "- Yog tus neeg nug txog hnub los sis qhov chaw uas tsis muaj ntaub ntawv, hais tseeb tias tsis tau muaj "
    "ntaub ntawv, txhob xav kom.\n"
    "- Yog cov lus nug NYOB DEB ntawm qhov kws pab tau (xws li mob hnyav ceev, lwm yam tsis txog huab cua), "
    "hais LUV LUV tias qhov no nyob deb ntawm qhov kws pab tau, thiab qhia meej tias pab tau dab tsi xwb."
)


def _format_context(context: dict | None) -> str:
    if not context:
        return "DỮ LIỆU DỰ BÁO: hiện chưa có dữ liệu dự báo cho xã này."
    commune = context.get("commune", {})
    forecast = context.get("forecast", [])
    lines = [
        f"DỮ LIỆU DỰ BÁO 5 NGÀY TỚI CHO XÃ {commune.get('name', '')} "
        f"(ngày 1 = ngày mai tính từ hôm nay, ngày 2 = ngày kia, v.v. — đọc kỹ đúng ngày người dùng hỏi):"
    ]
    for row in forecast:
        lines.append(
            f"- Ngày {row.get('day_index')} ({row.get('date')}): nhiệt độ ~{row.get('temp_downscaled')}°C, "
            f"lượng mưa ~{row.get('precip_downscaled')}mm, mức rủi ro {row.get('risk_level')} "
            f"({row.get('hazard_label')}), khuyến nghị: {row.get('recommended_action')}"
        )
    return "\n".join(lines)


def _build_system(language: str, mode: str, context: dict | None) -> str:
    ctx_block = _format_context(context)
    if language == "hmong":
        style = (
            "Koj yog HmongBridge AI, ib tug pab txhawb rau Hmoob nyob ib cheeb tsam roob Điện Biên txog "
            "huab cua thiab kev tiv thaiv xwm ceev.\n"
            + _SCOPE_RULES_HMONG
            + "\n\nPIAV QHIA:\n"
            + ("- Teb 2-3 kab lus luv luv, TSUM tiav tag ib lub kab, txhob txiav nrab kab.\n" if mode == "speech"
               else "- Teb 3-5 kab lus, meej thiab txaus siab.\n")
            + "- Teb ua lus Hmoob xwb, txhob siv lwm yam lus.\n"
            + "- Tsis txhob siv markdown los sis cim tshaj.\n\n"
            + ctx_block
        )
    else:
        style = (
            "Bạn là Trạm Bản AI, trợ lý hỗ trợ người dân xã miền núi Điện Biên hiểu và ứng phó với thời tiết "
            "nguy hiểm.\n"
            + _SCOPE_RULES_VI
            + "\n\nCÁCH TRẢ LỜI:\n"
            + ("- Trả lời 2-3 câu ngắn gọn, nói xong trọn câu, không dừng giữa chừng.\n" if mode == "speech"
               else "- Trả lời 3-5 câu, rõ ràng, có thể đưa lời khuyên cụ thể về mùa vụ/chăn nuôi nếu phù hợp.\n")
            + "- Luôn trả lời bằng tiếng Việt.\n"
            + "- Không dùng markdown, danh sách, hay ký hiệu đặc biệt.\n\n"
            + ctx_block
        )
    return style


_SPELL_CORRECT_HMONG = (
    "Koj yog tus kws lus Hmoob. Kho cov lus sau tsis raug hauv cov lus Hmoob hauv qab no.\n\n"
    "STRICT RULES:\n"
    "- Only fix spelling errors and tone diacritics — do NOT change meaning, add words, or remove words\n"
    "- Keep sentence structure and all content identical\n"
    "- If already correct, return unchanged\n"
    "- Return ONLY the corrected text, no explanations\n\n"
    "Text: {text}"
)

_SPELL_CORRECT_VIET = (
    "Bạn là chuyên gia tiếng Việt. Sửa lỗi chính tả trong văn bản tiếng Việt dưới đây.\n\n"
    "QUY TẮC NGHIÊM NGẶT:\n"
    "- Chỉ sửa lỗi chính tả và dấu thanh — KHÔNG thay đổi nội dung, ý nghĩa hay cấu trúc câu\n"
    "- Giữ nguyên tất cả từ ngữ, không thêm/bớt từ\n"
    "- Nếu văn bản đã đúng, trả về nguyên văn\n"
    "- Chỉ trả về văn bản đã sửa, không giải thích\n\n"
    "Văn bản: {text}"
)


def _call(messages: list, max_tokens: int = _DEFAULT_MAX_TOKENS, temperature: float = 0.5, _label: str = "llm") -> str:
    t0 = time.time()
    response = _client.chat.completions.create(
        model=config.DEEPSEEK_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    choice = response.choices[0]
    text = (choice.message.content or "").strip()
    finish = choice.finish_reason or ""
    if finish == "length" or not text:
        _log.warning("[LATENCY] %s: %.2fs | out_chars=%d | TRUNCATED/EMPTY (max_tokens=%d hit)",
                     _label, time.time() - t0, len(text), max_tokens)
    else:
        _log.info("[LATENCY] %s: %.2fs | out_chars=%d | finish=%s",
                  _label, time.time() - t0, len(text), finish)
    return text


def chat_speech(history: list, user_message: str, language: str = "hmong", context: dict | None = None) -> str:
    system = _build_system(language, "speech", context)
    messages = [{"role": "system", "content": system}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})
    return _call(messages, temperature=0.4, _label="llm_chat_speech")


def chat_text(history: list, user_message: str, language: str = "vietnamese", context: dict | None = None) -> str:
    system = _build_system(language, "text", context)
    messages = [{"role": "system", "content": system}]
    messages.extend(history[-20:])
    messages.append({"role": "user", "content": user_message})
    return _call(messages, temperature=0.5, _label="llm_chat_text")


def spell_correct(text: str, lang: str) -> str:
    if not text.strip():
        return text
    if lang == "hmong":
        prompt = _SPELL_CORRECT_HMONG.format(text=text)
    else:
        prompt = _SPELL_CORRECT_VIET.format(text=text)
    messages = [
        {"role": "system", "content": "You are a spell checker. Return only the corrected text, no explanations."},
        {"role": "user", "content": prompt},
    ]
    return _call(messages, max_tokens=400, temperature=0.1, _label="llm_spell")


def chat_text_stream(history: list, user_message: str, language: str = "vietnamese", context: dict | None = None):
    system = _build_system(language, "text", context)
    messages = [{"role": "system", "content": system}]
    messages.extend(history[-20:])
    messages.append({"role": "user", "content": user_message})
    stream = _client.chat.completions.create(
        model=config.DEEPSEEK_MODEL,
        messages=messages,
        max_tokens=_DEFAULT_MAX_TOKENS,
        temperature=0.5,
        stream=True,
    )
    t0 = time.time()
    t_first = None
    total_chars = 0
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            tok = chunk.choices[0].delta.content
            if t_first is None:
                t_first = time.time()
                _log.info("[LATENCY] llm_chat_text_ttft: %.2fs", t_first - t0)
            total_chars += len(tok)
            yield tok
    _log.info("[LATENCY] llm_chat_text_total: %.2fs | out_chars=%d", time.time() - t0, total_chars)


def chat_speech_stream(history: list, user_message: str, language: str = "hmong", context: dict | None = None):
    system = _build_system(language, "speech", context)
    messages = [{"role": "system", "content": system}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})
    stream = _client.chat.completions.create(
        model=config.DEEPSEEK_MODEL,
        messages=messages,
        max_tokens=_DEFAULT_MAX_TOKENS,
        temperature=0.4,
        stream=True,
    )
    t0 = time.time()
    t_first = None
    total_chars = 0
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            tok = chunk.choices[0].delta.content
            if t_first is None:
                t_first = time.time()
                _log.info("[LATENCY] llm_chat_speech_ttft: %.2fs", t_first - t0)
            total_chars += len(tok)
            yield tok
    _log.info("[LATENCY] llm_chat_speech_total: %.2fs | out_chars=%d", time.time() - t0, total_chars)


def preprocess_for_tts(text: str) -> str:
    text = re.sub(r"\*{1,3}|_{1,2}|~~|`{1,3}", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^\)]*\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(
        r"[\U0001F300-\U0001F9FF\U00002700-\U000027BF\U0001FA00-\U0001FAFF]",
        "",
        text,
        flags=re.UNICODE,
    )
    text = re.sub(r"\s+", " ", text)
    cleaned = text.strip()
    return cleaned if cleaned else text.strip()
