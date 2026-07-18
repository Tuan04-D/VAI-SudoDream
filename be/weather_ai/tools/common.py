from __future__ import annotations

import json
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


USER_AGENT = "DienBienWeatherAgent/0.1 (public-safety prototype)"


class DataSourceError(RuntimeError):
    """Nguon du lieu ben ngoai khong the truy cap hoac tra du lieu sai."""


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D").lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporary.replace(path)


def request_json(
    url: str,
    *,
    timeout: float,
    query: dict[str, Any] | None = None,
    form: dict[str, Any] | None = None,
) -> Any:
    if query:
        url = f"{url}?{urllib.parse.urlencode(query, doseq=True)}"
    data = None
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return json.loads(response.read().decode(charset))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise DataSourceError(f"Khong doc duoc {url}: {exc}") from exc

