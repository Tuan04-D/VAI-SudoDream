from __future__ import annotations

import logging
import secrets
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, NoReturn
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile

from .advisory import build_advisory
from .agent import AgentConfigurationError, AgentResult, DienBienWeatherAgent
from .config import get_settings
from .delivery import (
    SmsConfigurationError,
    SmsProviderError,
    SmsSendRequest,
    SmsSendResult,
    SmsService,
)
from .schemas import (
    AdvisoryRequest,
    AdvisoryResponse,
    CompactAdvisoryResponse,
)
from .tools.common import DataSourceError
from .video_hazard import VideoAnalysisError, VideoHazardAgent


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()
agent = DienBienWeatherAgent(settings=settings)
video_hazard_agent = VideoHazardAgent(settings=settings)
sms_service = SmsService()

MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024
VIDEO_UPLOAD_CHUNK_BYTES = 1024 * 1024


def refresh_landslide_cache() -> None:
    try:
        result = agent.landslide_service.refresh(force=True)
        logger.info(
            "Da cap nhat cache sat lo: %s ban ghi Dien Bien", len(result.get("records", []))
        )
    except Exception:
        logger.exception("Khong cap nhat duoc cache sat lo; se giu cache cu neu co")


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler = BackgroundScheduler(timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(
        refresh_landslide_cache,
        "interval",
        hours=settings.landslide_refresh_hours,
        next_run_time=datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")),
        id="refresh-landslide-dien-bien",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Điện Biên Weather & Landslide AI",
    version="0.3.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "openai_key_configured": bool(settings.openai_api_key),
        "landslide_refresh_hours": settings.landslide_refresh_hours,
    }


@app.get("/api/v1/delivery/sms/health")
def sms_health() -> dict[str, object]:
    return sms_service.health()


@app.post("/api/v1/delivery/sms", response_model=SmsSendResult)
def send_sms(
    request: SmsSendRequest,
    x_delivery_key: str | None = Header(default=None),
) -> SmsSendResult:
    if not request.dry_run:
        expected_key = sms_service.settings.delivery_api_key
        if not expected_key or not x_delivery_key or not secrets.compare_digest(
            expected_key, x_delivery_key
        ):
            raise HTTPException(status_code=403, detail="Delivery key không hợp lệ.")
    try:
        return sms_service.send(
            request.phone,
            request.message,
            dry_run=request.dry_run,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SmsConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SmsProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _generate_advisory(
    request: AdvisoryRequest,
) -> tuple[AgentResult, dict[str, Any]]:
    result = agent.run(
        commune=request.commune,
        question=request.question,
        days=request.days,
        latitude=request.latitude,
        longitude=request.longitude,
    )
    advisory = build_advisory(
        commune=result.commune,
        answer=result.answer,
        source_data=result.source_data,
    )
    return result, advisory


def _raise_advisory_http_error(exc: Exception) -> NoReturn:
    if isinstance(exc, AgentConfigurationError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, (DataSourceError, ValueError)):
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # Khong ghi exception message cua SDK: mot so provider co the chen
    # thong tin xac thuc vao message, lam ro ri secret vao log/API response.
    logger.error("Agent gap loi: %s", type(exc).__name__)
    raise HTTPException(
        status_code=502,
        detail="Agent không gọi được mô hình. Kiểm tra OPENAI_API_KEY và OPENAI_MODEL.",
    ) from exc


async def _save_video_upload(video: UploadFile) -> Path:
    suffix = Path(video.filename or "video").suffix.lower()
    temporary_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    temporary_path = Path(temporary_file.name)
    bytes_written = 0
    try:
        with temporary_file:
            while chunk := await video.read(VIDEO_UPLOAD_CHUNK_BYTES):
                bytes_written += len(chunk)
                if bytes_written > MAX_VIDEO_UPLOAD_BYTES:
                    raise VideoAnalysisError(
                        "Video tải lên vượt quá giới hạn 100 MB."
                    )
                temporary_file.write(chunk)
        return temporary_path
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


@app.post("/api/v1/video-hazard")
async def analyze_video_hazard(
    video: UploadFile = File(...), location: str | None = Form(default=None)
) -> dict[str, Any]:
    """Analyze an uploaded short video and return only the hazard-assessment JSON."""
    temporary_path: Path | None = None
    try:
        temporary_path = await _save_video_upload(video)
        result = video_hazard_agent.analyze(temporary_path, location)
        return result.assessment
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except VideoAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Video hazard agent gap loi: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Không thể hoàn tất phân tích video. Kiểm tra cấu hình OpenAI.",
        ) from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        await video.close()


def _detail_links(request: AdvisoryRequest, commune: str) -> dict[str, str]:
    weather_query: dict[str, Any] = {"commune": commune, "days": request.days}
    if request.latitude is not None and request.longitude is not None:
        weather_query.update(
            {"latitude": request.latitude, "longitude": request.longitude}
        )
    return {
        "weather_details": f"/api/v1/weather?{urlencode(weather_query)}",
        "landslide_details": f"/api/v1/landslides?{urlencode({'commune': commune})}",
        "debug_full_response": "/api/v1/advisories/debug",
    }


@app.post("/api/v1/advisories", response_model=CompactAdvisoryResponse)
def create_advisory(request: AdvisoryRequest) -> CompactAdvisoryResponse:
    """Response gon cho giao dien; khong tra source data va tool trace."""
    try:
        result, advisory = _generate_advisory(request)
        bulletin = advisory["bulletin"]
        compact_advisory = {
            key: advisory[key]
            for key in (
                "id",
                "overall_risk",
                "location",
                "validity",
                "current_weather",
                "daily_forecast",
                "language_support",
                "data_sources",
                "data_quality",
                "disclaimer",
            )
        }
        compact_advisory["bulletin"] = {
            "language": bulletin["language"],
            "title": bulletin["title"],
            "text": bulletin["llm_text"],
            "sms_text": bulletin["channel_messages"]["sms"],
        }
        return CompactAdvisoryResponse.model_validate(
            {
                "schema_version": "1.1",
                "advisory": compact_advisory,
                "links": _detail_links(request, result.commune),
            }
        )
    except Exception as exc:
        _raise_advisory_http_error(exc)


@app.post("/api/v1/advisories/debug", response_model=AdvisoryResponse)
def create_advisory_debug(request: AdvisoryRequest) -> AdvisoryResponse:
    """Response day du cho phat trien: co du lieu tool va trace cua agent."""
    try:
        result, advisory = _generate_advisory(request)
        return AdvisoryResponse.model_validate(
            {
                "schema_version": "1.1",
                "answer": result.answer,
                "commune": result.commune,
                "model": result.model,
                "advisory": advisory,
                "tool_trace": result.tool_trace,
                "source_data": result.source_data,
            }
        )
    except Exception as exc:
        _raise_advisory_http_error(exc)


@app.get("/api/v1/landslides")
def get_landslides(commune: str = Query(default="")) -> dict[str, Any]:
    try:
        return agent.landslide_service.get_warnings(commune)
    except DataSourceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/v1/landslides/refresh")
def refresh_landslides() -> dict[str, Any]:
    try:
        result = agent.landslide_service.refresh(force=True)
        return {
            "status": "ok",
            "records": len(result.get("records", [])),
            "fetched_at": result.get("fetched_at"),
            "cache_status": result.get("cache_status"),
        }
    except DataSourceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/weather")
def get_weather(
    commune: str,
    days: int = Query(default=3, ge=1, le=7),
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    try:
        return agent.weather_service.get_forecast(
            commune, days, latitude, longitude
        )
    except (DataSourceError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
