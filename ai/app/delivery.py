from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field


TWILIO_MESSAGES_URL = (
    "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
)
_VIETNAM_PHONE_RE = re.compile(r"^84\d{9}$")


class SmsConfigurationError(RuntimeError):
    pass


class SmsProviderError(RuntimeError):
    pass


class SmsSendRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)
    message: str = Field(min_length=1, max_length=1000)
    dry_run: bool = True


class SmsSendResult(BaseModel):
    provider: str
    status: str
    recipient: str
    message: str
    message_length: int
    provider_message_id: str | None = None


@dataclass(frozen=True)
class SmsSettings:
    provider: str
    android_gateway_url: str
    android_username: str
    android_password: str
    account_sid: str
    auth_token: str
    sender_id: str
    brand_name: str
    delivery_api_key: str
    live_send_enabled: bool
    timeout_seconds: float

    @property
    def provider_configured(self) -> bool:
        if self.provider == "android":
            return bool(
                self.android_gateway_url
                and self.android_username
                and self.android_password
            )
        if self.provider == "twilio":
            return bool(self.account_sid and self.auth_token and self.sender_id)
        return False


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def get_sms_settings() -> SmsSettings:
    return SmsSettings(
        provider=os.getenv("SMS_PROVIDER", "android").strip().lower() or "android",
        android_gateway_url=os.getenv("ANDROID_SMS_GATEWAY_URL", "").strip(),
        android_username=os.getenv("ANDROID_SMS_GATEWAY_USERNAME", "").strip(),
        android_password=os.getenv("ANDROID_SMS_GATEWAY_PASSWORD", "").strip(),
        account_sid=os.getenv("TWILIO_ACCOUNT_SID", "").strip(),
        auth_token=os.getenv("TWILIO_AUTH_TOKEN", "").strip(),
        sender_id=os.getenv("TWILIO_SENDER_ID", "").strip(),
        brand_name=os.getenv("SMS_BRAND_NAME", "TRAM BAN").strip() or "TRAM BAN",
        delivery_api_key=os.getenv("DELIVERY_API_KEY", "").strip(),
        live_send_enabled=_env_bool("SMS_LIVE_SEND_ENABLED"),
        timeout_seconds=max(5.0, float(os.getenv("HTTP_TIMEOUT_SECONDS", "30"))),
    )


def normalize_vietnam_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "84" + digits[1:]
    if not _VIETNAM_PHONE_RE.fullmatch(digits):
        raise ValueError(
            "Số điện thoại Việt Nam không hợp lệ; dùng dạng 09xxxxxxxx hoặc +849xxxxxxxx."
        )
    return f"+{digits}"


def mask_phone(phone: str) -> str:
    normalized = normalize_vietnam_phone(phone)
    return f"{normalized[:3]}******{normalized[-3:]}"


class SmsService:
    def __init__(self, settings: SmsSettings | None = None):
        self.settings = settings or get_sms_settings()

    def health(self) -> dict[str, object]:
        return {
            "provider": self.settings.provider,
            "provider_configured": self.settings.provider_configured,
            "live_send_enabled": self.settings.live_send_enabled,
            "delivery_key_configured": bool(self.settings.delivery_api_key),
            "brand_name": self.settings.brand_name,
        }

    def prepare_message(self, message: str) -> str:
        clean = " ".join(message.split())
        if not clean:
            raise ValueError("Nội dung SMS không được để trống.")
        prefix = f"[{self.settings.brand_name}]"
        if clean.casefold().startswith(prefix.casefold()):
            return clean
        return f"{prefix} {clean}"

    def send(self, phone: str, message: str, *, dry_run: bool = True) -> SmsSendResult:
        recipient = normalize_vietnam_phone(phone)
        body = self.prepare_message(message)
        common = {
            "provider": self.settings.provider,
            "recipient": mask_phone(recipient),
            "message": body,
            "message_length": len(body),
        }
        if dry_run:
            return SmsSendResult(status="dry_run", **common)

        if not self.settings.live_send_enabled:
            raise SmsConfigurationError(
                "Gửi thật đang tắt; đặt SMS_LIVE_SEND_ENABLED=true sau khi kiểm tra gateway."
            )
        if not self.settings.provider_configured:
            if self.settings.provider == "android":
                raise SmsConfigurationError(
                    "Thiếu ANDROID_SMS_GATEWAY_URL, ANDROID_SMS_GATEWAY_USERNAME "
                    "hoặc ANDROID_SMS_GATEWAY_PASSWORD."
                )
            if self.settings.provider == "twilio":
                raise SmsConfigurationError(
                    "Thiếu TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN hoặc TWILIO_SENDER_ID."
                )
            raise SmsConfigurationError(
                "SMS_PROVIDER không hợp lệ; chỉ hỗ trợ android hoặc twilio."
            )

        if self.settings.provider == "android":
            provider_response = self._send_android(recipient, body)
        elif self.settings.provider == "twilio":
            provider_response = self._send_twilio(recipient, body)
        else:
            raise SmsConfigurationError(
                "SMS_PROVIDER không hợp lệ; chỉ hỗ trợ android hoặc twilio."
            )

        return SmsSendResult(
            status=str(provider_response.get("status") or "queued"),
            provider_message_id=provider_response.get("message_id"),
            **common,
        )

    def _send_android(self, recipient: str, body: str) -> dict[str, str | None]:
        gateway_url = self.settings.android_gateway_url.rstrip("/")
        parsed_url = urlparse(gateway_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.hostname:
            raise SmsConfigurationError("ANDROID_SMS_GATEWAY_URL không hợp lệ.")
        payload = json.dumps(
            {
                "textMessage": {"text": body},
                "phoneNumbers": [recipient],
            },
            ensure_ascii=False,
        ).encode("utf-8")
        request = Request(
            gateway_url,
            data=payload,
            method="POST",
            headers={
                "Authorization": self._basic_auth(
                    self.settings.android_username,
                    self.settings.android_password,
                ),
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "TramBan/1.0",
            },
        )
        response = self._open_json(request, "Android SMS Gateway")
        item = response[0] if isinstance(response, list) and response else response
        if not isinstance(item, dict):
            item = {}
        return {
            "status": str(item.get("state") or item.get("status") or "queued"),
            "message_id": item.get("id") or item.get("messageId"),
        }

    def _send_twilio(self, recipient: str, body: str) -> dict[str, str | None]:

        payload = urlencode(
            {"To": recipient, "From": self.settings.sender_id, "Body": body}
        ).encode("utf-8")
        request = Request(
            TWILIO_MESSAGES_URL.format(account_sid=self.settings.account_sid),
            data=payload,
            method="POST",
            headers={
                "Authorization": self._basic_auth(
                    self.settings.account_sid,
                    self.settings.auth_token,
                ),
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "TramBan/1.0",
            },
        )
        provider_response = self._open_json(request, "Twilio")
        if not isinstance(provider_response, dict):
            provider_response = {}
        return {
            "status": str(provider_response.get("status") or "queued"),
            "message_id": provider_response.get("sid"),
        }

    @staticmethod
    def _basic_auth(username: str, password: str) -> str:
        token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode(
            "ascii"
        )
        return f"Basic {token}"

    def _open_json(self, request: Request, provider: str) -> object:
        try:
            with urlopen(request, timeout=self.settings.timeout_seconds) as response:
                raw = response.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except HTTPError as exc:
            raise SmsProviderError(f"{provider} trả HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise SmsProviderError(
                f"Không kết nối hoặc đọc được phản hồi từ {provider}."
            ) from exc
