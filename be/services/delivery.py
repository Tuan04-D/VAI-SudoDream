"""Durable SMS outbox worker.

Alert creation only queues deliveries in MongoDB. This worker owns provider
calls and retry state, so opening the web UI can never trigger duplicate SMS.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from core import config
from infrastructure import mongo as db


_log = logging.getLogger("delivery_service")


async def enqueue_for_alert(alert: dict) -> int:
    return await db.enqueue_sms_deliveries(alert)


async def _send_one(client: httpx.AsyncClient, delivery: dict) -> bool:
    try:
        response = await client.post(
            config.SMS_SERVICE_URL,
            headers={"X-Delivery-Key": config.SMS_DELIVERY_API_KEY},
            json={
                "phone": delivery["recipient_phone"],
                "message": delivery["message"],
                "dry_run": False,
            },
        )
        response.raise_for_status()
        payload = response.json()
        await db.complete_sms_delivery(
            delivery["id"],
            str(payload.get("status") or "submitted"),
            payload.get("provider_message_id"),
        )
        return True
    except Exception as exc:
        # Do not persist provider response bodies: they can contain credentials
        # or PII. A bounded exception type/message is enough for operations.
        safe_error = f"{type(exc).__name__}: {str(exc)[:300]}"
        await db.fail_sms_delivery(delivery["id"], safe_error, int(delivery["attempt_count"]))
        _log.warning("SMS delivery %s failed: %s", delivery["id"], type(exc).__name__)
        return False


async def process_pending_sms(batch_size: int = 20) -> dict[str, int | bool]:
    # Delivery expansion is idempotent and must be repaired even while live
    # provider sending is disabled.
    await db.reconcile_alert_outbox()
    if not config.SMS_ENABLED:
        return {"enabled": False, "claimed": 0, "submitted": 0, "failed": 0}
    if not config.SMS_DELIVERY_API_KEY or not config.SMS_SERVICE_URL:
        _log.error("SMS_ENABLED=true nhưng thiếu SMS_SERVICE_URL hoặc SMS_DELIVERY_API_KEY")
        return {"enabled": True, "claimed": 0, "submitted": 0, "failed": 0}

    await db.release_stale_delivery_locks()
    deliveries = await db.claim_sms_deliveries(limit=batch_size)
    if not deliveries:
        return {"enabled": True, "claimed": 0, "submitted": 0, "failed": 0}

    timeout = httpx.Timeout(config.HTTP_TIMEOUT_SECONDS)
    limits = httpx.Limits(max_connections=5, max_keepalive_connections=5)
    semaphore = asyncio.Semaphore(5)
    async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
        async def guarded(delivery: dict) -> bool:
            async with semaphore:
                return await _send_one(client, delivery)

        outcomes = await asyncio.gather(*(guarded(item) for item in deliveries))
    submitted = sum(1 for outcome in outcomes if outcome)
    return {
        "enabled": True,
        "claimed": len(deliveries),
        "submitted": submitted,
        "failed": len(deliveries) - submitted,
    }
