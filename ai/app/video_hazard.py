from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openai import OpenAI

from .agent import AgentConfigurationError
from .config import Settings, get_settings


SUPPORTED_VIDEO_SUFFIXES = {".avi", ".mov", ".mp4"}
MAX_VIDEO_SECONDS = 120.0
MAX_SAMPLED_FRAMES = 12
RISK_LEVELS = {"low", "moderate", "high", "indeterminate"}


VIDEO_HAZARD_INSTRUCTIONS = """Bạn là trợ lý hỗ trợ đánh giá rủi ro từ hình ảnh video.
Chỉ đánh giá dấu hiệu NHÌN THẤY trong các khung hình: nước ngập/chảy xiết, bùn đá,
xói lở, vết nứt, mái dốc mất ổn định, cây hoặc công trình nghiêng, và đường bị hư hại.
Không suy đoán thời tiết, địa điểm, thời gian hoặc nguy cơ không có bằng chứng hình ảnh.

Trả về DUY NHẤT một đối tượng JSON hợp lệ với các khóa:
{
  "landslide_risk": "low|moderate|high|indeterminate",
  "flood_risk": "low|moderate|high|indeterminate",
  "observed_hazards": [
    {"hazard": "...", "evidence": "...", "frame_timestamps_seconds": [0.0]}
  ],
  "limitations": ["..."],
  "recommended_actions": ["..."],
  "advisory": "..."
}

Đây là hỗ trợ ra quyết định, không phải cảnh báo chính thức hay lệnh sơ tán. Nếu khung
hình tối, mờ, bị che khuất hoặc không đủ để đánh giá, dùng "indeterminate", nêu giới
hạn và đề nghị đối chiếu cơ quan chức năng tại địa phương. Viết mọi giá trị văn bản bằng
tiếng Việt phổ thông, ngắn gọn và dễ hiểu."""


class VideoAnalysisError(ValueError):
    """Raised when a local video cannot produce a reliable visual assessment."""


@dataclass(frozen=True)
class VideoFrame:
    timestamp_seconds: float
    jpeg_bytes: bytes


@dataclass(frozen=True)
class VideoMetadata:
    filename: str
    duration_seconds: float
    frame_count: int
    frames_per_second: float
    width: int
    height: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "filename": self.filename,
            "duration_seconds": round(self.duration_seconds, 2),
            "frame_count": self.frame_count,
            "frames_per_second": round(self.frames_per_second, 2),
            "width": self.width,
            "height": self.height,
        }


@dataclass(frozen=True)
class VideoHazardResult:
    video: VideoMetadata
    location: str | None
    sampled_timestamps_seconds: list[float]
    assessment: dict[str, Any]
    model: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "video": self.video.to_dict(),
            "location": self.location,
            "sampled_timestamps_seconds": self.sampled_timestamps_seconds,
            "model": self.model,
            "assessment": self.assessment,
        }


def _load_cv2() -> Any:
    try:
        import cv2
    except ImportError as exc:
        raise VideoAnalysisError(
            "Thiếu OpenCV. Hãy cài đặt dependency từ requirements.txt."
        ) from exc
    return cv2


def _sample_indices(frame_count: int) -> list[int]:
    if frame_count < 1:
        return []
    sample_count = min(MAX_SAMPLED_FRAMES, frame_count)
    if sample_count == 1:
        return [0]
    return [
        round(position * (frame_count - 1) / (sample_count - 1))
        for position in range(sample_count)
    ]


def extract_video_frames(video_path: str | Path) -> tuple[VideoMetadata, list[VideoFrame]]:
    """Validate a short video and return up to twelve JPEG frames without persisting them."""
    path = Path(video_path)
    if not path.is_file():
        raise VideoAnalysisError(f"Không tìm thấy tệp video: {path}")
    if path.suffix.lower() not in SUPPORTED_VIDEO_SUFFIXES:
        formats = ", ".join(sorted(SUPPORTED_VIDEO_SUFFIXES))
        raise VideoAnalysisError(f"Định dạng video không hỗ trợ. Chỉ nhận: {formats}.")

    cv2 = _load_cv2()
    capture = cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened():
            raise VideoAnalysisError("Không thể mở video. Tệp có thể bị hỏng hoặc không được hỗ trợ.")
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if fps <= 0 or frame_count <= 0:
            raise VideoAnalysisError("Video thiếu thông tin số khung hình hoặc tốc độ khung hình.")

        duration_seconds = frame_count / fps
        if duration_seconds > MAX_VIDEO_SECONDS:
            raise VideoAnalysisError(
                f"Video dài {duration_seconds:.1f} giây; giới hạn là {MAX_VIDEO_SECONDS:.0f} giây."
            )

        metadata = VideoMetadata(
            filename=path.name,
            duration_seconds=duration_seconds,
            frame_count=frame_count,
            frames_per_second=fps,
            width=int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0),
            height=int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0),
        )
        frames: list[VideoFrame] = []
        for frame_index in _sample_indices(frame_count):
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, image = capture.read()
            if not ok:
                continue
            encoded, jpeg = cv2.imencode(".jpg", image)
            if not encoded:
                continue
            frames.append(
                VideoFrame(
                    timestamp_seconds=round(frame_index / fps, 2),
                    jpeg_bytes=jpeg.tobytes(),
                )
            )
    finally:
        capture.release()

    if not frames:
        raise VideoAnalysisError("Không trích xuất được khung hình nào từ video.")
    return metadata, frames


def _json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]).strip()
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise VideoAnalysisError("Mô hình không trả về đánh giá JSON hợp lệ.") from exc
    if not isinstance(value, dict):
        raise VideoAnalysisError("Mô hình trả về đánh giá có định dạng không hợp lệ.")
    return value


def _text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _risk_level(value: Any) -> str:
    candidate = str(value).strip().lower()
    return candidate if candidate in RISK_LEVELS else "indeterminate"


def normalize_assessment(value: dict[str, Any]) -> dict[str, Any]:
    observed_hazards: list[dict[str, Any]] = []
    raw_hazards = value.get("observed_hazards", [])
    if isinstance(raw_hazards, list):
        for item in raw_hazards:
            if not isinstance(item, dict):
                continue
            timestamps = item.get("frame_timestamps_seconds", [])
            parsed_timestamps = []
            if isinstance(timestamps, list):
                for timestamp in timestamps:
                    try:
                        parsed_timestamps.append(round(float(timestamp), 2))
                    except (TypeError, ValueError):
                        continue
            hazard = str(item.get("hazard", "")).strip()
            evidence = str(item.get("evidence", "")).strip()
            if hazard or evidence:
                observed_hazards.append(
                    {
                        "hazard": hazard or "Dấu hiệu chưa xác định",
                        "evidence": evidence or "Mô hình không nêu bằng chứng cụ thể.",
                        "frame_timestamps_seconds": parsed_timestamps,
                    }
                )

    advisory = str(value.get("advisory", "")).strip()
    return {
        "landslide_risk": _risk_level(value.get("landslide_risk")),
        "flood_risk": _risk_level(value.get("flood_risk")),
        "observed_hazards": observed_hazards,
        "limitations": _text_list(value.get("limitations")),
        "recommended_actions": _text_list(value.get("recommended_actions")),
        "advisory": advisory or "Chưa có kết luận đủ tin cậy từ các khung hình.",
    }


def _risk_label(level: str) -> str:
    return {
        "low": "Thấp",
        "moderate": "Trung bình",
        "high": "Cao",
        "indeterminate": "Chưa xác định",
    }[level]


def format_report(result: VideoHazardResult) -> str:
    assessment = result.assessment
    lines = [
        "ĐÁNH GIÁ NGUY CƠ TỪ VIDEO",
        f"Video: {result.video.filename} ({result.video.duration_seconds:.1f} giây)",
        f"Địa điểm: {result.location or 'Chưa cung cấp'}",
        f"Nguy cơ sạt lở từ hình ảnh: {_risk_label(assessment['landslide_risk'])}",
        f"Nguy cơ ngập lụt từ hình ảnh: {_risk_label(assessment['flood_risk'])}",
        "",
        "Dấu hiệu quan sát:",
    ]
    hazards = assessment["observed_hazards"]
    if hazards:
        for item in hazards:
            timestamps = ", ".join(f"{value:g}s" for value in item["frame_timestamps_seconds"])
            time_note = f" (khung {timestamps})" if timestamps else ""
            lines.append(f"- {item['hazard']}: {item['evidence']}{time_note}")
    else:
        lines.append("- Không có dấu hiệu cụ thể được mô hình nêu.")

    if assessment["limitations"]:
        lines.extend(["", "Giới hạn:"])
        lines.extend(f"- {item}" for item in assessment["limitations"])
    if assessment["recommended_actions"]:
        lines.extend(["", "Khuyến nghị:"])
        lines.extend(f"- {item}" for item in assessment["recommended_actions"])
    lines.extend(
        [
            "",
            f"Nhận định: {assessment['advisory']}",
            "Lưu ý: Đây là hỗ trợ từ hình ảnh, không phải cảnh báo chính thức hoặc lệnh sơ tán.",
        ]
    )
    return "\n".join(lines)


class VideoHazardAgent:
    def __init__(self, settings: Settings | None = None, client: OpenAI | None = None):
        self.settings = settings or get_settings()
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

    def analyze(
        self, video_path: str | Path, location: str | None = None
    ) -> VideoHazardResult:
        metadata, frames = extract_video_frames(video_path)
        location = location.strip() if location and location.strip() else None
        timestamps = [frame.timestamp_seconds for frame in frames]
        prompt = (
            f"Video: {metadata.filename}; thời lượng: {metadata.duration_seconds:.1f} giây.\n"
            f"Địa điểm do người vận hành cung cấp: {location or 'Chưa cung cấp'}.\n"
            f"Khung hình được lấy lần lượt theo thời gian tại giây: {timestamps}.\n"
            "Hãy đánh giá các dấu hiệu nhìn thấy và trả về JSON theo đúng cấu trúc đã yêu cầu."
        )
        content: list[dict[str, Any]] = [{"type": "input_text", "text": prompt}]
        content.extend(
            {
                "type": "input_image",
                "image_url": "data:image/jpeg;base64,"
                + base64.b64encode(frame.jpeg_bytes).decode("ascii"),
                "detail": "high",
            }
            for frame in frames
        )
        response = self.client.responses.create(
            model=self.settings.openai_model,
            instructions=VIDEO_HAZARD_INSTRUCTIONS,
            input=[{"role": "user", "content": content}],
        )
        assessment = normalize_assessment(_json_object(response.output_text))
        return VideoHazardResult(
            video=metadata,
            location=location,
            sampled_timestamps_seconds=timestamps,
            assessment=assessment,
            model=self.settings.openai_model,
        )
