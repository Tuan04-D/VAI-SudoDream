"""FastAPI application factory and cross-cutting HTTP behavior."""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import alerts, chat_support, forecast, identity, system
from chat.routers import chat, voice
from core import config
from services.runtime import lifespan


log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Trạm Bản API",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", uuid.uuid4().hex)
        log.exception("Unhandled request error request_id=%s path=%s", request_id, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Lỗi hệ thống", "request_id": request_id},
            headers={"X-Request-ID": request_id},
        )

    app.include_router(system.router)
    app.include_router(forecast.router)
    app.include_router(identity.router)
    app.include_router(alerts.router)
    app.include_router(chat_support.router)
    app.include_router(chat.router)
    app.include_router(voice.router)
    return app
