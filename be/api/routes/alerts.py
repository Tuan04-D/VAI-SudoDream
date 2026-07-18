"""Alert, officer and notification endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

import communes
import forecast_service
from core import config, security
from infrastructure import mongo
from services import alerts as alert_service


router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/notifications")
async def notifications(limit: int = 20):
    return [alert_service.serialize_alert(row) for row in await mongo.list_alerts(limit)]


@router.get("/alerts")
async def commune_alerts(commune_id: str, limit: int = 200):
    if commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    rows = await mongo.list_alerts_by_commune(commune_id, max(1, min(limit, 200)))
    return [alert_service.serialize_alert(row) for row in rows]


@router.post("/notifications/generate")
async def generate_notifications(
    _: Annotated[dict, Depends(security.require_roles("admin"))],
):
    created = await alert_service.run_notification_cycle()
    return {"created": len(created), "items": [alert_service.serialize_alert(row) for row in created]}


@router.post("/alerts/{alert_id}/view")
async def view_alert(
    alert_id: str,
    user: Annotated[dict, Depends(security.get_current_user)],
):
    if user["role"] != "resident":
        raise HTTPException(status_code=403, detail="Chỉ người dân có thể xác nhận đã xem")
    alert = await mongo.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert["commune_id"] != user.get("commune_id"):
        raise HTTPException(status_code=403, detail="Cảnh báo không thuộc xã đã đăng ký")
    await mongo.mark_alert_viewed(user["_id"], alert_id)
    return {"ok": True}


officer_or_admin = security.require_roles("official", "admin")


def _enforce_commune_scope(user: dict, commune_id: str) -> None:
    if user["role"] == "official" and user.get("commune_id") != commune_id:
        raise HTTPException(status_code=403, detail="Cán bộ chỉ được thao tác trong xã mình")


@router.get("/officer/alerts")
async def officer_alerts(
    commune_id: str,
    user: Annotated[dict, Depends(officer_or_admin)],
):
    if commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    _enforce_commune_scope(user, commune_id)
    rows = await mongo.list_alerts_by_commune(commune_id)
    return [alert_service.serialize_alert(row) for row in rows]


@router.get("/officer/viewed-map")
async def viewed_map(
    alert_id: str,
    user: Annotated[dict, Depends(officer_or_admin)],
):
    result = await mongo.viewed_map_for_alert(alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    _enforce_commune_scope(user, result["alert"]["commune_id"])
    return {
        "alert": alert_service.serialize_alert(result["alert"]),
        "residents": result["residents"],
    }


@router.post("/officer/alerts/{commune_id}/send")
async def send_alert(
    commune_id: str,
    request: Request,
    user: Annotated[dict, Depends(officer_or_admin)],
):
    commune = communes.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    _enforce_commune_scope(user, commune_id)
    detail = await forecast_service.get_commune_forecast(commune_id, 1)
    today = detail["forecast"][0] if detail["forecast"] else None
    risk = today["risk"] if today else detail["overall_risk"]
    alert = await alert_service.create_for_commune(
        commune_id,
        commune["name"],
        risk,
        today or {},
        status="officer",
        sent_by=user["_id"],
    )
    if not alert:
        raise HTTPException(status_code=409, detail="Cảnh báo không thay đổi so với lần gần nhất")
    await mongo.write_audit(
        actor_id=user["_id"],
        actor_role=user["role"],
        action="send_officer_alert",
        entity_type="alert",
        entity_id=alert["id"],
        metadata={"commune_id": commune_id},
        ip=request.client.host if request.client else None,
    )
    return alert_service.serialize_alert(alert)


@router.get("/officer/residents")
async def officer_residents(
    user: Annotated[dict, Depends(officer_or_admin)],
    commune_id: str | None = None,
):
    target = commune_id or user.get("commune_id")
    if not target:
        raise HTTPException(status_code=422, detail="Cần chọn xã")
    _enforce_commune_scope(user, target)
    return [security.public_user(row) for row in await mongo.list_residents_by_commune(target)]


@router.get("/admin/notify-config")
async def notify_config(_: Annotated[dict, Depends(security.require_roles("admin"))]):
    return {"hour": config.NOTIFY_HOUR, "minute": config.NOTIFY_MINUTE}
