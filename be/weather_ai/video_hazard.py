"""
Video hazard analysis — stub.

The real implementation (frame extraction via OpenCV + vision-model
assessment) lives in the teammate's fe/ai prototype at
fe/ai/app/video_hazard.py and was never copied over when weather_ai was
merged into this backend. It depends on OpenAI's vision-capable Responses
API with its own OPENAI_API_KEY/OPENAI_MODEL, separate from the
DeepSeek-backed LLM_PROVIDER used for chat/bulletins here — DeepSeek's
configured model does not do vision.

This stub only restores the import contract server.py needs (the class
names and the exception it catches for the 100MB upload-size check) so the
backend can start. POST /api/v1/video-hazard responds with a clear 503
until the real analysis is wired up.
"""
from __future__ import annotations

from pathlib import Path

from .agent import AgentConfigurationError


class VideoAnalysisError(ValueError):
    """Raised when a local video cannot produce a reliable visual assessment."""


class VideoHazardAgent:
    def analyze(self, video_path: str | Path, location: str | None = None):
        raise AgentConfigurationError(
            "Phân tích video chưa được cấu hình. Tính năng này cần một OPENAI_API_KEY "
            "hỗ trợ vision (xem fe/ai/app/video_hazard.py để hoàn thiện)."
        )
