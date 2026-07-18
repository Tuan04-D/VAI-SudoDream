"""SQLite persistence — residents, officials, chat history, alerts and
alert-view tracking. Stdlib sqlite3, no ORM: this is a hackathon-scope data
layer, not a service meant to handle concurrent writers at scale.
"""
import hashlib
import hmac
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "trambaen.db"

_PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> tuple[str, str]:
    """Returns (salt_hex, hash_hex). PBKDF2-SHA256, stdlib only (no bcrypt
    dependency) — appropriate for this app's scale, not a high-throughput
    auth service."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return salt, digest.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), _PBKDF2_ITERATIONS)
    return hmac.compare_digest(digest.hex(), hash_hex)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS residents (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    commune_id TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS officials (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    commune_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL REFERENCES residents(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_resident ON chat_messages(resident_id, created_at);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    commune_id TEXT NOT NULL,
    commune_name TEXT NOT NULL,
    date TEXT NOT NULL,
    risk_level INTEGER NOT NULL,
    risk_label TEXT NOT NULL,
    risk_color TEXT NOT NULL,
    hazard_type TEXT,
    message_vi TEXT NOT NULL,
    hmong_tts_text TEXT,
    audio_url TEXT,
    status TEXT NOT NULL,
    sent_by TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_commune ON alerts(commune_id, created_at);

CREATE TABLE IF NOT EXISTS alert_views (
    id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL REFERENCES residents(id),
    alert_id TEXT NOT NULL REFERENCES alerts(id),
    viewed_at TEXT NOT NULL,
    UNIQUE(resident_id, alert_id)
);
"""


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        resident_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(residents)").fetchall()
        }
        if "address" not in resident_columns:
            conn.execute("ALTER TABLE residents ADD COLUMN address TEXT NOT NULL DEFAULT ''")


def _row(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None


# --- residents ---

def create_resident(phone: str, password: str, display_name: str, commune_id: str, lat: float, lon: float) -> dict:
    rid = new_id()
    salt, pw_hash = hash_password(password)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO residents (id, phone, password_salt, password_hash, display_name, commune_id, lat, lon, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (rid, phone, salt, pw_hash, display_name, commune_id, lat, lon, now_iso()),
        )
    return get_resident(rid)


def subscribe_resident(phone: str, address: str, commune_id: str, lat: float, lon: float) -> dict:
    """Create or update an alert subscription without exposing account credentials."""
    existing = get_resident_by_phone(phone)
    if existing:
        with get_conn() as conn:
            conn.execute(
                "UPDATE residents SET address = ?, commune_id = ?, lat = ?, lon = ? WHERE id = ?",
                (address, commune_id, lat, lon, existing["id"]),
            )
        return get_resident(existing["id"])

    rid = new_id()
    salt, pw_hash = hash_password(secrets.token_urlsafe(24))
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO residents "
            "(id, phone, password_salt, password_hash, display_name, address, commune_id, lat, lon, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (rid, phone, salt, pw_hash, "Người dân", address, commune_id, lat, lon, now_iso()),
        )
    return get_resident(rid)


def get_resident(resident_id: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM residents WHERE id = ?", (resident_id,)).fetchone())


def get_resident_by_phone(phone: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM residents WHERE phone = ?", (phone,)).fetchone())


def authenticate_resident(phone: str, password: str) -> dict | None:
    resident = get_resident_by_phone(phone)
    if not resident or not verify_password(password, resident["password_salt"], resident["password_hash"]):
        return None
    return resident


def update_resident(resident_id: str, display_name: str, commune_id: str, lat: float, lon: float) -> dict | None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE residents SET display_name = ?, commune_id = ?, lat = ?, lon = ? WHERE id = ?",
            (display_name, commune_id, lat, lon, resident_id),
        )
    return get_resident(resident_id)


def list_residents_by_commune(commune_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM residents WHERE commune_id = ? ORDER BY created_at DESC",
            (commune_id,),
        ).fetchall()
    return [dict(r) for r in rows]


# --- officials ---

def create_official(phone: str, password: str, display_name: str, commune_id: str) -> dict:
    oid = new_id()
    salt, pw_hash = hash_password(password)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO officials (id, phone, password_salt, password_hash, display_name, commune_id, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (oid, phone, salt, pw_hash, display_name, commune_id, now_iso()),
        )
    return get_official(oid)


def get_official(official_id: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM officials WHERE id = ?", (official_id,)).fetchone())


def get_official_by_phone(phone: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM officials WHERE phone = ?", (phone,)).fetchone())


def authenticate_official(phone: str, password: str) -> dict | None:
    official = get_official_by_phone(phone)
    if not official or not verify_password(password, official["password_salt"], official["password_hash"]):
        return None
    return official


# --- chat history ---

def add_chat_message(resident_id: str, role: str, content: str, language: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO chat_messages (id, resident_id, role, content, language, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (new_id(), resident_id, role, content, language, now_iso()),
        )


def get_chat_history(resident_id: str, limit: int = 200) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE resident_id = ? ORDER BY created_at ASC LIMIT ?",
            (resident_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


# --- alerts ---

def create_alert(
    *, commune_id: str, commune_name: str, date: str, risk_level: int, risk_label: str,
    risk_color: str, hazard_type: str | None, message_vi: str, hmong_tts_text: str | None,
    audio_url: str | None, status: str, sent_by: str | None,
) -> dict:
    aid = new_id()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO alerts (id, commune_id, commune_name, date, risk_level, risk_label, risk_color, "
            "hazard_type, message_vi, hmong_tts_text, audio_url, status, sent_by, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (aid, commune_id, commune_name, date, risk_level, risk_label, risk_color, hazard_type,
             message_vi, hmong_tts_text, audio_url, status, sent_by, now_iso()),
        )
    return get_alert(aid)


def get_alert(alert_id: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone())


def set_alert_audio(alert_id: str, audio_url: str | None) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE alerts SET audio_url = ? WHERE id = ?", (audio_url, alert_id))


def list_alerts(limit: int = 20) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


def list_alerts_by_commune(commune_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts WHERE commune_id = ? ORDER BY created_at DESC", (commune_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def latest_alert_for_commune(commune_id: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute(
            "SELECT * FROM alerts WHERE commune_id = ? ORDER BY created_at DESC LIMIT 1", (commune_id,)
        ).fetchone())


def should_create_alert(commune_id: str, date: str, risk_level: int, hazard_type: str | None) -> bool:
    """BR02/BR03 (dedup / escalation), adapted: skip if the latest alert for
    this commune today already reflects the same hazard at the same or
    higher level; always create if severity rose."""
    latest = latest_alert_for_commune(commune_id)
    if not latest or latest["date"] != date:
        return True
    if risk_level > latest["risk_level"]:
        return True
    if risk_level < latest["risk_level"] or hazard_type != latest["hazard_type"]:
        return True
    return False


# --- alert views ---

def mark_alert_viewed(resident_id: str, alert_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO alert_views (id, resident_id, alert_id, viewed_at) VALUES (?, ?, ?, ?)",
            (new_id(), resident_id, alert_id, now_iso()),
        )


def viewed_map_for_alert(alert_id: str) -> dict | None:
    alert = get_alert(alert_id)
    if not alert:
        return None
    with get_conn() as conn:
        residents = conn.execute(
            "SELECT * FROM residents WHERE commune_id = ?", (alert["commune_id"],)
        ).fetchall()
        viewed_ids = {
            row["resident_id"] for row in conn.execute(
                "SELECT resident_id FROM alert_views WHERE alert_id = ?", (alert_id,)
            ).fetchall()
        }
    return {
        "alert": alert,
        "residents": [{**dict(r), "viewed": r["id"] in viewed_ids} for r in residents],
    }
