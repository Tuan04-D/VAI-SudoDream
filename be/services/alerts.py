"""Alert orchestration: risk decision, persistence, audit and delivery outbox."""

from __future__ import annotations

import asyncio
import logging

import communes
import forecast_service
import llm_notify
from chat.model_client import model_client
from infrastructure import mongo
from services import delivery


log = logging.getLogger(__name__)


def serialize_alert(row: dict) -> dict:
    return {**row, "audio_language": "hmong"}


def dominant_hazard_type(row: dict) -> str | None:
    """Choose the hazard used by the alert detail link."""
    if row.get("landslide"):
        return "landslide"
    if row.get("flash_flood"):
        return "flash_flood"
    hazards = row.get("hazards") or []
    top = max(hazards, key=lambda item: item["severity"]["level"], default=None)
    return top["type"] if top else None


async def _synthesize_hmong(text: str) -> str | None:
    if not model_client.base_url:
        return None
    try:
        result = await model_client.synthesize(text, "hmong")
        return f"data:audio/wav;base64,{result['audio']}"
    except Exception as exc:
        log.warning("Hmong TTS unavailable: %s", type(exc).__name__)
        return None


async def create_for_commune(
    commune_id: str,
    commune_name: str,
    risk: dict,
    hazards_row: dict,
    *,
    status: str,
    sent_by: str | None,
) -> dict | None:
    """Create one deduplicated alert and safely expand its delivery outbox."""
    hazard_type = dominant_hazard_type(hazards_row)
    date = forecast_service.date_for_day(0)
    if not await mongo.should_create_alert(commune_id, date, risk["level"], hazard_type):
        return None

    detail = await forecast_service.get_commune_forecast(commune_id)
    bulletin = detail["bulletin"] or {
        "sms_text": f"{risk['label']} - {commune_name}.",
        "text": "",
    }
    hmong_text = await asyncio.to_thread(
        llm_notify.translate_to_hmong_tts, bulletin["sms_text"]
    )
    audio_url = await _synthesize_hmong(hmong_text)
    alert = await mongo.create_alert(
        commune_id=commune_id,
        commune_name=commune_name,
        date=date,
        risk_level=risk["level"],
        risk_label=risk["label"],
        risk_color=risk["color"],
        hazard_type=hazard_type,
        message_vi=bulletin["sms_text"],
        hmong_tts_text=hmong_text,
        audio_url=audio_url,
        status=status,
        sent_by=sent_by,
    )
    if not alert:
        return None

    queued = 0
    try:
        queued = await delivery.enqueue_for_alert(alert)
    except Exception:
        # Reconciliation retries pending alert expansion after a crash/error.
        log.exception("Could not expand outbox for alert %s", alert["id"])
    await mongo.write_audit(
        actor_id=sent_by,
        actor_role="system" if status == "auto" else "official",
        action="create_alert",
        entity_type="alert",
        entity_id=alert["id"],
        metadata={"commune_id": commune_id, "queued_sms": queued, "status": status},
    )
    return alert


async def run_notification_cycle() -> list[dict]:
    """Automatically publish only critical (level 3) commune alerts."""
    ranked = forecast_service.top_risk_communes(
        day_index=0, limit=len(communes.COMMUNES)
    )
    critical = [row for row in ranked if row["risk"]["level"] >= 3]
    created: list[dict] = []
    for row in critical:
        alert = await create_for_commune(
            row["commune_id"],
            row["name"],
            row["risk"],
            row,
            status="auto",
            sent_by=None,
        )
        if alert:
            created.append(alert)
    log.info("Notification cycle created=%d scanned=%d", len(created), len(critical))
    return created
