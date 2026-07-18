from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

from .config import Settings, get_settings
from .tools import LandslideService, WeatherService


SYSTEM_PROMPT = """Bạn là trợ lý cảnh báo thời tiết cho người dân Điện Biên.
Dữ liệu từ get_weather_forecast và get_landslide_warnings đã được ứng dụng nạp
cho đúng xã người dùng yêu cầu ở phần dữ liệu nguồn. Chỉ dùng số liệu đó, không tự
bịa. Nếu dữ liệu thiếu hoặc cần làm rõ, bạn vẫn có thể gọi lại tool tương ứng.

Viết tiếng Việt phổ thông, câu ngắn, dễ nghe qua loa phát thanh. Kết quả gồm:
1) dòng mức cảnh báo với biểu tượng và màu; 2) thời gian, địa điểm; 3) diễn biến
chính; 4) 3-5 hành động cụ thể cho người dân và cán bộ bản; 5) nguồn và thời điểm
dữ liệu. Phân biệt rõ dữ liệu dự báo với cảnh báo chính thức. Nếu cache cũ hoặc
không thấy xã trong danh sách cảnh báo, phải nói rõ giới hạn đó. Không tuyên bố
"an toàn tuyệt đối". Chưa dịch sang tiếng Thái hoặc tiếng Mông trong phiên bản này.
"""


TOOLS = [
    {
        "type": "function",
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
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "get_landslide_warnings",
        "description": "Lấy cảnh báo sạt lở/lũ quét hiện tại của NCHMF tại Điện Biên.",
        "parameters": {
            "type": "object",
            "properties": {
                "commune": {"type": "string", "description": "Tên xã/phường"}
            },
            "required": ["commune"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


class AgentConfigurationError(RuntimeError):
    pass


@dataclass
class AgentResult:
    answer: str
    commune: str
    model: str
    tool_trace: list[dict[str, Any]]
    source_data: dict[str, Any]


class DienBienWeatherAgent:
    def __init__(
        self,
        settings: Settings | None = None,
        landslide_service: LandslideService | None = None,
        weather_service: WeatherService | None = None,
        client: OpenAI | None = None,
    ):
        self.settings = settings or get_settings()
        self.landslide_service = landslide_service or LandslideService(
            self.settings.landslide_cache_path,
            self.settings.landslide_refresh_hours,
            self.settings.http_timeout_seconds,
        )
        self.weather_service = weather_service or WeatherService(
            self.landslide_service, self.settings.http_timeout_seconds
        )
        self._client = client

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if not self.settings.openai_api_key:
                raise AgentConfigurationError(
                    "OPENAI_API_KEY đang trống. Hãy điền key vào ai/.env rồi khởi động lại."
                )
            self._client = OpenAI(api_key=self.settings.openai_api_key)
        return self._client

    def raw_context(
        self,
        commune: str,
        days: int = 3,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> dict[str, Any]:
        return {
            "landslide": self.landslide_service.get_warnings(commune),
            "weather": self.weather_service.get_forecast(
                commune, days, latitude, longitude
            ),
        }

    def _execute_tool(
        self,
        name: str,
        arguments: dict[str, Any],
        *,
        commune: str,
        days: int,
        latitude: float | None,
        longitude: float | None,
    ) -> dict[str, Any]:
        # Dia diem tu request API la nguon tin cay; khong de model doi sang tinh khac.
        if name == "get_landslide_warnings":
            return self.landslide_service.get_warnings(commune)
        if name == "get_weather_forecast":
            return self.weather_service.get_forecast(
                commune,
                min(max(int(arguments.get("days", days)), 1), 7),
                latitude,
                longitude,
            )
        raise ValueError(f"Tool không được hỗ trợ: {name}")

    def run(
        self,
        commune: str,
        question: str | None = None,
        days: int = 3,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> AgentResult:
        commune = commune.strip()
        if not commune:
            raise ValueError("commune không được để trống.")
        days = min(max(int(days), 1), 7)
        user_text = (
            f"Địa điểm bắt buộc: {commune}, tỉnh Điện Biên. "
            f"Cần dự báo {days} ngày. "
            f"Yêu cầu: {question or 'Hãy tạo bản tin cảnh báo ngắn gọn cho người dân.'}"
        )
        input_items: list[Any] = [{"role": "user", "content": user_text}]
        trace: list[dict[str, Any]] = []
        # Nap du lieu truoc de agent van hoat dong voi model khong tu dong phat
        # sinh function-call. Hai thao tac nay chinh la viec thuc thi tool cua app.
        try:
            source_data = self.raw_context(commune, days, latitude, longitude)
            trace.extend(
                [
                    {"tool": "get_landslide_warnings", "ok": True, "mode": "preloaded"},
                    {"tool": "get_weather_forecast", "ok": True, "mode": "preloaded"},
                ]
            )
        except Exception as exc:
            source_data = {"error": str(exc)}
            trace.append({"tool": "data_preload", "ok": False, "error": str(exc)})
        input_items.append(
            {
                "role": "user",
                "content": "DỮ LIỆU NGUỒN TỪ CÁC TOOL (JSON):\n"
                + json.dumps(source_data, ensure_ascii=False),
            }
        )

        for _ in range(8):
            response = self.client.responses.create(
                model=self.settings.openai_model,
                instructions=SYSTEM_PROMPT,
                tools=TOOLS,
                input=input_items,
            )
            input_items += list(response.output)
            calls = [item for item in response.output if item.type == "function_call"]
            if calls:
                for call in calls:
                    try:
                        arguments = json.loads(call.arguments or "{}")
                        output = self._execute_tool(
                            call.name,
                            arguments,
                            commune=commune,
                            days=days,
                            latitude=latitude,
                            longitude=longitude,
                        )
                        source_data[call.name] = output
                        trace.append({"tool": call.name, "ok": True})
                    except Exception as exc:  # Tool error phai duoc dua lai cho model.
                        output = {"error": str(exc), "tool": call.name}
                        trace.append({"tool": call.name, "ok": False, "error": str(exc)})
                    input_items.append(
                        {
                            "type": "function_call_output",
                            "call_id": call.call_id,
                            "output": json.dumps(output, ensure_ascii=False),
                        }
                    )
                continue

            if response.output_text:
                return AgentResult(
                    answer=response.output_text,
                    commune=commune,
                    model=self.settings.openai_model,
                    tool_trace=trace,
                    source_data=source_data,
                )

        raise RuntimeError("Agent vượt quá số vòng gọi tool cho phép.")
