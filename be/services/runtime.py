"""Application startup, shutdown and scheduled background jobs."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI

import communes
import forecast_service
from chat.model_client import model_client
from core import config, security
from infrastructure import mongo
from services import alerts, delivery


log = logging.getLogger(__name__)


async def _warm_optional_services() -> None:
    try:
        await model_client.warmup()
        await forecast_service.warm_caches()
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("Background warmup failed; requests will retry on demand")


def _build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        alerts.run_notification_cycle,
        CronTrigger(hour=config.NOTIFY_HOUR, minute=config.NOTIFY_MINUTE),
        id="daily_notify",
        replace_existing=True,
    )
    scheduler.add_job(
        forecast_service.warm_caches,
        IntervalTrigger(minutes=config.WEATHER_CACHE_MINUTES),
        id="warm_forecast_cache",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        delivery.process_pending_sms,
        IntervalTrigger(seconds=config.SMS_WORKER_SECONDS),
        id="sms_outbox_worker",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    return scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    security.validate_configuration()
    await mongo.init_db(communes.COMMUNES)
    await security.ensure_bootstrap_admin()

    scheduler = _build_scheduler() if config.SCHEDULER_ENABLED else None
    if scheduler:
        scheduler.start()
    app.state.scheduler = scheduler
    warmup_task = asyncio.create_task(_warm_optional_services()) if config.WARMUP_ENABLED else None
    log.info(
        "Application ready scheduler=%s warmup=%s",
        config.SCHEDULER_ENABLED,
        config.WARMUP_ENABLED,
    )
    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
        if warmup_task:
            warmup_task.cancel()
            with suppress(asyncio.CancelledError):
                await warmup_task
        await model_client.close()
        await mongo.close_db()
