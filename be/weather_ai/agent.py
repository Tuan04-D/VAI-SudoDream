"""
Weather + landslide advisory agent — adapted from the original fe/ai
prototype. The only real change from that original is the LLM call: the
original used OpenAI's Responses API (`client.responses.create`, OpenAI-only).
This version uses the standard `chat.completions.create` with function
calling instead, because that endpoint is supported by both OpenAI and
DeepSeek (and most other OpenAI-compatible providers) — required now that
LLM_PROVIDER is a runtime choice (see llm_provider.py), not hardcoded OpenAI.

Source data (weather + landslide) is preloaded into the prompt before the
first LLM call, same as the original — the model rarely needs to actually
invoke a tool since the numbers it needs are already in context. This also
means the agent still produces a real bulletin even if a given provider's
function-calling support is shaky.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from core import config
import llm_provider
from .tools import LandslideService, WeatherService

_log = logging.getLogger(__name__)

SYSTEM_PROMPT = """Bạn là trợ lý cảnh báo thời tiết cho người dân Điện Biên.
Dữ liệu từ get_weather_forecast và get_landslide_warnings đã được ứng dụng nạp
cho đúng xã người dùng yêu cầu ở phần dữ liệu nguồn. Chỉ dùng số liệu đó, không tự
bịa. Nếu dữ liệu thiếu hoặc cần làm rõ, bạn vẫn có thể gọi lại tool tương ứng.

Viết tiếng Việt phổ thông, câu ngắn, dễ nghe qua loa phát thanh. Định dạng bằng
markdown (in đậm cho mức cảnh báo, danh sách có số cho hành động cụ thể) — giao
diện sẽ tự render markdown này. Kết quả gồm: 1) dòng mức cảnh báo (in đậm); 2)
thời gian, địa điểm; 3) diễn biến chính; 4) danh sách 3-5 hành động cụ thể cho
người dân và cán bộ bản; 5) nguồn và thời điểm dữ liệu. Phân biệt rõ dữ liệu dự
báo với cảnh báo chính thức. Nếu cache cũ hoặc không thấy xã trong danh sách
cảnh báo, phải nói rõ giới hạn đó. Không tuyên bố "an toàn tuyệt đối". Chưa dịch
sang tiếng Thái hoặc tiếng Mông trong phiên bản này.

Mỗi ngày trong dữ liệu nguồn có thể có trường "confidence" (score, level,
label, spread_precip_mm, spread_temp_c). Đây là mức đồng thuận giữa ba mô hình
ECMWF/GFS/ICON, không phải xác suất thiên tai. Nếu confidence.level của hôm nay
là "low" hoặc "medium", phải thêm một câu ngắn giải thích các mô hình còn chênh
lệch về mưa hoặc nhiệt độ và khuyên theo dõi bản tin cập nhật; không được diễn
giải confidence như cam kết dự báo chắc chắn.

TUYỆT ĐỐI KHÔNG dùng emoji, icon, hay ký hiệu trang trí (✅⚠️🔴 v.v.) trong nội
dung — giao diện đã có icon và màu riêng để thể hiện mức độ nguy hiểm.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather_forecast",
            "description": "Lấy dự báo thời tiết chi tiết theo xã tại Điện Biên.",
            "parameters": {
                "type": "object",
                "properties": {
                    "commune": {"type": "string", "description": "Tên xã/phường"},
                    "days": {"type": "integer", "minimum": 1, "maximum": 7},
                    "latitude": {"type": ["number", "null"]},
                    "longitude": {"type": ["number", "null"]},
                },
                "required": ["commune", "days", "latitude", "longitude"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_landslide_warnings",
            "description": "Lấy cảnh báo sạt lở/lũ quét hiện tại của NCHMF tại Điện Biên.",
            "parameters": {
                "type": "object",
                "properties": {
                    "commune": {"type": "string", "description": "Tên xã/phường"},
                },
                "required": ["commune"],
            },
        },
    },
]

_MAX_TOKENS = 2200  # generous: reasoning-model providers can burn 1000+ tokens before writing a word


class AgentConfigurationError(RuntimeError):
    pass


@dataclass
class AgentResult:
    answer: str
    commune: str
    model: str
    tool_trace: list[dict[str, Any]]
    source_data: dict[str, Any]


class WeatherAdvisoryAgent:
    def __init__(
        self,
        landslide_service: LandslideService | None = None,
        weather_service: WeatherService | None = None,
    ):
        self.landslide_service = landslide_service or LandslideService(
            config.LANDSLIDE_CACHE_PATH, config.LANDSLIDE_REFRESH_HOURS, config.HTTP_TIMEOUT_SECONDS
        )
        self.weather_service = weather_service or WeatherService(
            self.landslide_service, config.HTTP_TIMEOUT_SECONDS
        )

    def raw_context(
        self, commune: str, days: int = 3, latitude: float | None = None, longitude: float | None = None
    ) -> dict[str, Any]:
        return {
            "landslide": self.landslide_service.get_warnings(commune),
            "weather": self.weather_service.get_forecast(commune, days, latitude, longitude),
        }

    def _execute_tool(
        self, name: str, arguments: dict[str, Any], *, commune: str, days: int,
        latitude: float | None, longitude: float | None,
    ) -> dict[str, Any]:
        # Dia diem tu request la nguon tin cay; khong de model doi sang xa/tinh khac.
        if name == "get_landslide_warnings":
            return self.landslide_service.get_warnings(commune)
        if name == "get_weather_forecast":
            return self.weather_service.get_forecast(
                commune, min(max(int(arguments.get("days", days)), 1), 7), latitude, longitude
            )
        raise ValueError(f"Tool không được hỗ trợ: {name}")

    def run(
        self, commune: str, question: str | None = None, days: int = 3,
        latitude: float | None = None, longitude: float | None = None,
    ) -> AgentResult:
        if not llm_provider.is_configured():
            raise AgentConfigurationError(
                "LLM_API_KEY đang trống. Hãy điền key vào src/backend/.env rồi khởi động lại."
            )

        commune = commune.strip()
        if not commune:
            raise ValueError("commune không được để trống.")
        days = min(max(int(days), 1), 7)

        user_text = (
            f"Địa điểm bắt buộc: {commune}, tỉnh Điện Biên. "
            f"Cần dự báo {days} ngày. "
            f"Yêu cầu: {question or 'Hãy tạo bản tin cảnh báo ngắn gọn cho người dân.'}"
        )
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ]
        trace: list[dict[str, Any]] = []

        try:
            source_data = self.raw_context(commune, days, latitude, longitude)
            trace.extend([
                {"tool": "get_landslide_warnings", "ok": True, "mode": "preloaded"},
                {"tool": "get_weather_forecast", "ok": True, "mode": "preloaded"},
            ])
        except Exception as exc:
            source_data = {"error": str(exc)}
            trace.append({"tool": "data_preload", "ok": False, "error": str(exc)})

        messages.append({
            "role": "user",
            "content": "DỮ LIỆU NGUỒN TỪ CÁC TOOL (JSON):\n" + json.dumps(source_data, ensure_ascii=False),
        })

        client = llm_provider.get_client()
        model = llm_provider.get_model()

        for _ in range(6):
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOLS,
                max_tokens=_MAX_TOKENS,
                temperature=0.4,
            )
            message = response.choices[0].message
            tool_calls = message.tool_calls or []

            if tool_calls:
                messages.append({
                    "role": "assistant",
                    "content": message.content,
                    "tool_calls": [tc.model_dump() for tc in tool_calls],
                })
                for call in tool_calls:
                    try:
                        arguments = json.loads(call.function.arguments or "{}")
                        output = self._execute_tool(
                            call.function.name, arguments,
                            commune=commune, days=days, latitude=latitude, longitude=longitude,
                        )
                        source_data[call.function.name] = output
                        trace.append({"tool": call.function.name, "ok": True})
                    except Exception as exc:
                        output = {"error": str(exc), "tool": call.function.name}
                        trace.append({"tool": call.function.name, "ok": False, "error": str(exc)})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": json.dumps(output, ensure_ascii=False),
                    })
                continue

            content = (message.content or "").strip()
            if content:
                return AgentResult(
                    answer=content, commune=commune, model=model, tool_trace=trace, source_data=source_data,
                )
            _log.warning("weather_ai agent turn returned empty content, retrying")

        raise RuntimeError("Agent vượt quá số vòng gọi tool cho phép.")
