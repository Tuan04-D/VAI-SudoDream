"""Async MongoDB data-access layer for Trạm Bản.

All authorization-sensitive queries live behind this module. Mongo documents
use string `_id` values so the existing frontend contract can keep using `id`.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from pymongo import (
    ASCENDING,
    DESCENDING,
    GEOSPHERE,
    AsyncMongoClient,
    InsertOne,
    ReturnDocument,
    UpdateOne,
)
from pymongo.errors import BulkWriteError, DuplicateKeyError

from core import config


_client: AsyncMongoClient | None = None
_database: Any | None = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex[:24]


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("0"):
        digits = "84" + digits[1:]
    if not (digits.startswith("84") and len(digits) == 11):
        raise ValueError("Số điện thoại Việt Nam không hợp lệ")
    return f"+{digits}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _db() -> Any:
    if _database is None:
        raise RuntimeError("MongoDB chưa được khởi tạo")
    return _database


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    return value


def serialize_doc(document: dict | None) -> dict | None:
    if document is None:
        return None
    result = {("id" if key == "_id" else key): _json_value(value) for key, value in document.items()}
    location = result.pop("location", None)
    if isinstance(location, dict) and len(location.get("coordinates", [])) == 2:
        result["lon"], result["lat"] = location["coordinates"]
    return result


async def init_db(commune_rows: Iterable[dict]) -> None:
    """Connect, verify MongoDB, create workload indexes and sync communes."""
    global _client, _database
    _client = AsyncMongoClient(
        config.MONGO_URI,
        serverSelectionTimeoutMS=config.MONGO_CONNECT_TIMEOUT_MS,
        tz_aware=True,
        appname="tramban-api",
    )
    await _client.admin.command("ping")
    _database = _client[config.MONGO_DB_NAME]

    database = _db()
    await database.users.create_index("phone", unique=True, name="uq_users_phone")
    await database.users.create_index(
        [("role", ASCENDING), ("status", ASCENDING), ("commune_id", ASCENDING)],
        name="ix_users_role_status_commune",
    )
    await database.users.create_index(
        [("location", GEOSPHERE)], sparse=True, name="ix_users_location"
    )

    await database.communes.create_index("code", unique=True, name="uq_communes_code")
    await database.chat_messages.create_index(
        [("resident_id", ASCENDING), ("created_at", ASCENDING)],
        name="ix_chat_resident_created",
    )
    await database.alerts.create_index("dedup_key", unique=True, name="uq_alerts_dedup")
    await database.alerts.create_index(
        [("commune_id", ASCENDING), ("created_at", DESCENDING)],
        name="ix_alerts_commune_created",
    )
    await database.alert_views.create_index(
        [("resident_id", ASCENDING), ("alert_id", ASCENDING)],
        unique=True,
        name="uq_alert_views_resident_alert",
    )
    await database.alert_deliveries.create_index(
        [("alert_id", ASCENDING), ("recipient_id", ASCENDING), ("channel", ASCENDING)],
        unique=True,
        name="uq_deliveries_alert_recipient_channel",
    )
    await database.alert_deliveries.create_index(
        [("status", ASCENDING), ("next_attempt_at", ASCENDING)],
        name="ix_deliveries_status_next_attempt",
    )
    await database.alerts.create_index(
        [("delivery_outbox_status", ASCENDING), ("created_at", ASCENDING)],
        name="ix_alerts_outbox_created",
    )
    await database.auth_sessions.create_index("token_hash", unique=True, name="uq_sessions_token")
    await database.auth_sessions.create_index("user_id", name="ix_sessions_user")
    await database.auth_sessions.create_index(
        "expires_at", expireAfterSeconds=0, name="ttl_sessions_expires"
    )
    await database.audit_logs.create_index(
        [("actor_id", ASCENDING), ("created_at", DESCENDING)],
        name="ix_audit_actor_created",
    )
    await database.audit_logs.create_index(
        [("entity_type", ASCENDING), ("entity_id", ASCENDING), ("created_at", DESCENDING)],
        name="ix_audit_entity_created",
    )

    operations = []
    timestamp = now_utc()
    for row in commune_rows:
        operations.append(
            UpdateOne(
                {"code": str(row["id"])},
                {
                    "$set": {
                        "name": row["name"],
                        "kind": row.get("kind", "xa"),
                        "center": {
                            "type": "Point",
                            "coordinates": [float(row["lon"]), float(row["lat"])],
                        },
                        "active": True,
                        "updated_at": timestamp,
                    },
                    "$setOnInsert": {"_id": new_id(), "created_at": timestamp},
                },
                upsert=True,
            )
        )
    if operations:
        await database.communes.bulk_write(operations, ordered=False)


async def close_db() -> None:
    global _client, _database
    if _client is not None:
        await _client.close()
    _client = None
    _database = None


async def ping() -> bool:
    try:
        await _db().command("ping")
        return True
    except Exception:
        return False


# --- users / RBAC ---

async def create_user(
    *,
    phone: str,
    password_hash: str,
    display_name: str,
    role: str,
    commune_id: str | None,
    lat: float | None = None,
    lon: float | None = None,
    permissions: list[str] | None = None,
    status: str = "active",
) -> dict:
    timestamp = now_utc()
    document: dict[str, Any] = {
        "_id": new_id(),
        "phone": normalize_phone(phone),
        "password_hash": password_hash,
        "display_name": display_name.strip(),
        "role": role,
        "permissions": sorted(set(permissions or [])),
        "status": status,
        "commune_id": commune_id,
        "token_version": 1,
        "created_at": timestamp,
        "updated_at": timestamp,
        "last_login_at": None,
        "deleted_at": None,
    }
    if lat is not None and lon is not None:
        document["location"] = {"type": "Point", "coordinates": [float(lon), float(lat)]}
    try:
        await _db().users.insert_one(document)
    except DuplicateKeyError as exc:
        raise ValueError("Số điện thoại đã được đăng ký") from exc
    return serialize_doc(document) or {}


async def get_user(user_id: str, *, include_deleted: bool = False) -> dict | None:
    query: dict[str, Any] = {"_id": user_id}
    if not include_deleted:
        query["status"] = {"$ne": "deleted"}
    return serialize_doc(await _db().users.find_one(query))


async def get_user_raw(user_id: str, *, include_deleted: bool = False) -> dict | None:
    query: dict[str, Any] = {"_id": user_id}
    if not include_deleted:
        query["status"] = {"$ne": "deleted"}
    return await _db().users.find_one(query)


async def get_user_by_phone(phone: str) -> dict | None:
    try:
        normalized = normalize_phone(phone)
    except ValueError:
        return None
    return await _db().users.find_one({"phone": normalized, "status": {"$ne": "deleted"}})


async def list_users(
    *,
    role: str | None = None,
    commune_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    skip: int = 0,
) -> list[dict]:
    query: dict[str, Any] = {"status": {"$ne": "deleted"}}
    if role:
        query["role"] = role
    if commune_id:
        query["commune_id"] = commune_id
    if status:
        query["status"] = status
    cursor = _db().users.find(query).sort("created_at", DESCENDING).skip(skip).limit(min(limit, 500))
    rows = await cursor.to_list(length=min(limit, 500))
    return [serialize_doc(row) or {} for row in rows]


async def update_user(user_id: str, changes: dict[str, Any]) -> dict | None:
    allowed = {"display_name", "commune_id", "role", "permissions", "status", "location", "password_hash"}
    payload = {key: value for key, value in changes.items() if key in allowed}
    if not payload:
        return await get_user(user_id, include_deleted=True)
    payload["updated_at"] = now_utc()
    if "role" in payload or "permissions" in payload or "status" in payload or "password_hash" in payload:
        payload_update: dict[str, Any] = {"$set": payload, "$inc": {"token_version": 1}}
    else:
        payload_update = {"$set": payload}
    document = await _db().users.find_one_and_update(
        {"_id": user_id, "status": {"$ne": "deleted"}},
        payload_update,
        return_document=ReturnDocument.AFTER,
    )
    if document and ({"role", "permissions", "status", "password_hash"} & payload.keys()):
        # Refresh tokens are opaque sessions and do not carry token_version.
        # Revoke them whenever a security-sensitive user attribute changes.
        await delete_user_sessions(user_id)
    return serialize_doc(document)


async def soft_delete_user(user_id: str) -> bool:
    result = await _db().users.update_one(
        {"_id": user_id, "status": {"$ne": "deleted"}},
        {
            "$set": {"status": "deleted", "deleted_at": now_utc(), "updated_at": now_utc()},
            "$inc": {"token_version": 1},
        },
    )
    if result.modified_count:
        await delete_user_sessions(user_id)
    return bool(result.modified_count)


async def set_last_login(user_id: str) -> None:
    await _db().users.update_one(
        {"_id": user_id}, {"$set": {"last_login_at": now_utc(), "updated_at": now_utc()}}
    )


async def get_resident(resident_id: str) -> dict | None:
    document = await _db().users.find_one(
        {"_id": resident_id, "role": "resident", "status": {"$ne": "deleted"}}
    )
    return serialize_doc(document)


async def list_residents_by_commune(commune_id: str) -> list[dict]:
    cursor = _db().users.find(
        {"role": "resident", "status": "active", "commune_id": commune_id}
    ).sort("created_at", ASCENDING)
    return [serialize_doc(row) or {} for row in await cursor.to_list(length=None)]


# --- refresh sessions ---

async def create_session(
    *, user_id: str, token_hash: str, expires_at: datetime, user_agent: str | None, ip: str | None
) -> dict:
    document = {
        "_id": new_id(),
        "user_id": user_id,
        "token_hash": token_hash,
        "user_agent": (user_agent or "")[:500],
        "ip": (ip or "")[:100],
        "created_at": now_utc(),
        "last_used_at": now_utc(),
        "expires_at": expires_at,
    }
    await _db().auth_sessions.insert_one(document)
    return serialize_doc(document) or {}


async def get_session_by_hash(token_hash: str) -> dict | None:
    return await _db().auth_sessions.find_one(
        {"token_hash": token_hash, "expires_at": {"$gt": now_utc()}}
    )


async def rotate_session(
    old_token_hash: str,
    *,
    new_token_hash: str,
    expires_at: datetime,
    user_agent: str | None,
    ip: str | None,
) -> dict | None:
    return await _db().auth_sessions.find_one_and_update(
        {"token_hash": old_token_hash, "expires_at": {"$gt": now_utc()}},
        {
            "$set": {
                "token_hash": new_token_hash,
                "expires_at": expires_at,
                "last_used_at": now_utc(),
                "user_agent": (user_agent or "")[:500],
                "ip": (ip or "")[:100],
            }
        },
        return_document=ReturnDocument.AFTER,
    )


async def delete_session(token_hash: str) -> None:
    await _db().auth_sessions.delete_one({"token_hash": token_hash})


async def delete_user_sessions(user_id: str) -> None:
    await _db().auth_sessions.delete_many({"user_id": user_id})


# --- chat history ---

async def add_chat_message(resident_id: str, role: str, content: str, language: str) -> None:
    await _db().chat_messages.insert_one(
        {
            "_id": new_id(),
            "resident_id": resident_id,
            "role": role,
            "content": content,
            "language": language,
            "created_at": now_utc(),
        }
    )


async def get_chat_history(resident_id: str, limit: int = 200) -> list[dict]:
    cursor = _db().chat_messages.find({"resident_id": resident_id}).sort("created_at", ASCENDING).limit(limit)
    return [serialize_doc(row) or {} for row in await cursor.to_list(length=limit)]


# --- alerts ---

def alert_dedup_key(commune_id: str, date: str, risk_level: int, hazard_type: str | None) -> str:
    return f"{commune_id}:{date}:{risk_level}:{hazard_type or 'general'}"


async def should_create_alert(commune_id: str, date: str, risk_level: int, hazard_type: str | None) -> bool:
    key = alert_dedup_key(commune_id, date, risk_level, hazard_type)
    return await _db().alerts.count_documents({"dedup_key": key}, limit=1) == 0


async def create_alert(
    *,
    commune_id: str,
    commune_name: str,
    date: str,
    risk_level: int,
    risk_label: str,
    risk_color: str,
    hazard_type: str | None,
    message_vi: str,
    hmong_tts_text: str | None,
    audio_url: str | None,
    status: str,
    sent_by: str | None,
) -> dict | None:
    timestamp = now_utc()
    document = {
        "_id": new_id(),
        "dedup_key": alert_dedup_key(commune_id, date, risk_level, hazard_type),
        "commune_id": commune_id,
        "commune_name": commune_name,
        "date": date,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "risk_color": risk_color,
        "hazard_type": hazard_type,
        "message_vi": message_vi,
        "hmong_tts_text": hmong_tts_text,
        "audio_url": audio_url,
        "status": status,
        "delivery_outbox_status": "pending",
        "delivery_queued_at": None,
        "sent_by": sent_by,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    try:
        await _db().alerts.insert_one(document)
    except DuplicateKeyError:
        return None
    return serialize_doc(document)


async def get_alert(alert_id: str) -> dict | None:
    return serialize_doc(await _db().alerts.find_one({"_id": alert_id}))


async def list_alerts(limit: int = 20) -> list[dict]:
    cursor = _db().alerts.find().sort("created_at", DESCENDING).limit(min(limit, 200))
    return [serialize_doc(row) or {} for row in await cursor.to_list(length=min(limit, 200))]


async def list_alerts_by_commune(commune_id: str, limit: int = 200) -> list[dict]:
    cursor = _db().alerts.find({"commune_id": commune_id}).sort("created_at", DESCENDING).limit(limit)
    return [serialize_doc(row) or {} for row in await cursor.to_list(length=limit)]


async def mark_alert_viewed(resident_id: str, alert_id: str) -> None:
    await _db().alert_views.update_one(
        {"resident_id": resident_id, "alert_id": alert_id},
        {
            "$setOnInsert": {
                "_id": new_id(),
                "resident_id": resident_id,
                "alert_id": alert_id,
                "viewed_at": now_utc(),
            }
        },
        upsert=True,
    )


async def viewed_map_for_alert(alert_id: str) -> dict | None:
    alert = await get_alert(alert_id)
    if not alert:
        return None
    residents = await list_residents_by_commune(alert["commune_id"])
    viewed_rows = await _db().alert_views.find({"alert_id": alert_id}).to_list(length=None)
    viewed_ids = {row["resident_id"] for row in viewed_rows}
    public_keys = {
        "id", "phone", "display_name", "role", "status", "permissions",
        "commune_id", "lat", "lon", "created_at", "updated_at", "last_login_at",
    }
    safe_residents = [
        {key: value for key, value in resident.items() if key in public_keys}
        | {"viewed": resident["id"] in viewed_ids}
        for resident in residents
    ]
    return {"alert": alert, "residents": safe_residents}


# --- durable alert delivery outbox ---

async def enqueue_sms_deliveries(alert: dict) -> int:
    residents = await list_residents_by_commune(alert["commune_id"])
    if not residents:
        await _db().alerts.update_one(
            {"_id": alert["id"]},
            {"$set": {"delivery_outbox_status": "queued", "delivery_queued_at": now_utc()}},
        )
        return 0
    timestamp = now_utc()
    operations = [
        InsertOne(
            {
                "_id": new_id(),
                "alert_id": alert["id"],
                "recipient_id": resident["id"],
                "recipient_phone": resident["phone"],
                "commune_id": alert["commune_id"],
                "channel": "sms",
                "message": alert["message_vi"],
                "status": "pending",
                "attempt_count": 0,
                "next_attempt_at": timestamp,
                "locked_at": None,
                "provider_message_id": None,
                "provider_status": None,
                "last_error": None,
                "created_at": timestamp,
                "updated_at": timestamp,
                "submitted_at": None,
            }
        )
        for resident in residents
    ]
    inserted = 0
    try:
        result = await _db().alert_deliveries.bulk_write(operations, ordered=False)
        inserted = result.inserted_count
    except BulkWriteError as exc:
        # Unique delivery keys make replay safe after a partial write.
        write_errors = exc.details.get("writeErrors", [])
        if any(error.get("code") != 11000 for error in write_errors):
            raise
        inserted = int(exc.details.get("nInserted", 0))
    await _db().alerts.update_one(
        {"_id": alert["id"]},
        {"$set": {"delivery_outbox_status": "queued", "delivery_queued_at": now_utc()}},
    )
    return inserted


async def reconcile_alert_outbox(limit: int = 50) -> int:
    """Replay alert -> delivery expansion after a crash or partial failure."""
    cursor = _db().alerts.find(
        {"delivery_outbox_status": {"$ne": "queued"}}
    ).sort("created_at", ASCENDING).limit(limit)
    repaired = 0
    for document in await cursor.to_list(length=limit):
        await enqueue_sms_deliveries(serialize_doc(document) or {})
        repaired += 1
    return repaired


async def claim_sms_deliveries(limit: int = 20) -> list[dict]:
    claimed: list[dict] = []
    for _ in range(limit):
        document = await _db().alert_deliveries.find_one_and_update(
            {
                "channel": "sms",
                "status": {"$in": ["pending", "retry"]},
                "next_attempt_at": {"$lte": now_utc()},
                "attempt_count": {"$lt": config.SMS_MAX_ATTEMPTS},
            },
            {
                "$set": {"status": "processing", "locked_at": now_utc(), "updated_at": now_utc()},
                "$inc": {"attempt_count": 1},
            },
            sort=[("next_attempt_at", ASCENDING), ("created_at", ASCENDING)],
            return_document=ReturnDocument.AFTER,
        )
        if not document:
            break
        claimed.append(serialize_doc(document) or {})
    return claimed


async def complete_sms_delivery(
    delivery_id: str, provider_status: str, provider_message_id: str | None
) -> None:
    await _db().alert_deliveries.update_one(
        {"_id": delivery_id},
        {
            "$set": {
                "status": "submitted",
                "provider_status": provider_status,
                "provider_message_id": provider_message_id,
                "submitted_at": now_utc(),
                "updated_at": now_utc(),
                "locked_at": None,
                "last_error": None,
            }
        },
    )


async def fail_sms_delivery(delivery_id: str, error: str, attempt_count: int) -> None:
    terminal = attempt_count >= config.SMS_MAX_ATTEMPTS
    delay_seconds = min(3600, 30 * (2 ** max(0, attempt_count - 1)))
    await _db().alert_deliveries.update_one(
        {"_id": delivery_id},
        {
            "$set": {
                "status": "failed" if terminal else "retry",
                "last_error": error[:500],
                "next_attempt_at": now_utc() + timedelta(seconds=delay_seconds),
                "updated_at": now_utc(),
                "locked_at": None,
            }
        },
    )


async def release_stale_delivery_locks(minutes: int = 10) -> int:
    result = await _db().alert_deliveries.update_many(
        {"status": "processing", "locked_at": {"$lt": now_utc() - timedelta(minutes=minutes)}},
        {"$set": {
            "status": "retry", "next_attempt_at": now_utc(),
            "locked_at": None, "updated_at": now_utc(),
        }},
    )
    return result.modified_count


# --- audit log ---

async def write_audit(
    *,
    actor_id: str | None,
    actor_role: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    metadata: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    await _db().audit_logs.insert_one(
        {
            "_id": new_id(),
            "actor_id": actor_id,
            "actor_role": actor_role,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata or {},
            "ip": (ip or "")[:100],
            "created_at": now_utc(),
        }
    )


async def list_audit_logs(limit: int = 100) -> list[dict]:
    cursor = _db().audit_logs.find().sort("created_at", DESCENDING).limit(min(limit, 500))
    return [serialize_doc(row) or {} for row in await cursor.to_list(length=min(limit, 500))]
