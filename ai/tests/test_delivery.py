import json
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import parse_qs

from app.delivery import (
    SmsConfigurationError,
    SmsService,
    SmsSettings,
    mask_phone,
    normalize_vietnam_phone,
)

def make_settings(**overrides: object) -> SmsSettings:
    values = {
        "provider": "twilio",
        "android_gateway_url": "",
        "android_username": "",
        "android_password": "",
        "account_sid": "",
        "auth_token": "",
        "sender_id": "",
        "brand_name": "TRAM BAN",
        "delivery_api_key": "test-delivery-key",
        "live_send_enabled": False,
        "timeout_seconds": 10,
    }
    values.update(overrides)
    return SmsSettings(**values)


class FakeResponse:
    def __init__(self, payload: dict[str, object]):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


class SmsDeliveryTests(TestCase):
    def test_normalizes_and_masks_vietnam_phone(self):
        self.assertEqual(normalize_vietnam_phone("0918 359 253"), "+84918359253")
        self.assertEqual(normalize_vietnam_phone("+84 918 359 253"), "+84918359253")
        self.assertEqual(mask_phone("0918359253"), "+84******253")

    def test_rejects_invalid_phone(self):
        with self.assertRaises(ValueError):
            normalize_vietnam_phone("12345")

    @patch("app.delivery.urlopen")
    def test_dry_run_never_calls_provider(self, mocked_urlopen):
        result = SmsService(make_settings()).send(
            "0918359253", "Cảnh báo mưa lớn.", dry_run=True
        )

        self.assertEqual(result.status, "dry_run")
        self.assertEqual(result.recipient, "+84******253")
        self.assertEqual(result.message, "[TRAM BAN] Cảnh báo mưa lớn.")
        mocked_urlopen.assert_not_called()

    def test_live_send_is_disabled_by_default(self):
        with self.assertRaises(SmsConfigurationError):
            SmsService(make_settings()).send(
                "0918359253", "Cảnh báo mưa lớn.", dry_run=False
            )

    @patch("app.delivery.urlopen")
    def test_live_send_builds_twilio_request(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeResponse(
            {"sid": "SM123", "status": "queued"}
        )
        service = SmsService(
            make_settings(
                account_sid="AC123",
                auth_token="secret",
                sender_id="TRAMBAN",
                live_send_enabled=True,
            )
        )

        result = service.send("0918359253", "Cảnh báo mưa lớn.", dry_run=False)

        request = mocked_urlopen.call_args.args[0]
        form = parse_qs(request.data.decode("utf-8"))
        self.assertEqual(form["To"], ["+84918359253"])
        self.assertEqual(form["From"], ["TRAMBAN"])
        self.assertEqual(form["Body"], ["[TRAM BAN] Cảnh báo mưa lớn."])
        self.assertEqual(result.provider_message_id, "SM123")
        self.assertEqual(result.status, "queued")

    @patch("app.delivery.urlopen")
    def test_live_send_builds_android_gateway_request(self, mocked_urlopen):
        mocked_urlopen.return_value = FakeResponse(
            {"id": "android-123", "state": "Pending"}
        )
        service = SmsService(
            make_settings(
                provider="android",
                android_gateway_url="http://192.168.1.50:8080/message",
                android_username="phone-user",
                android_password="phone-password",
                live_send_enabled=True,
            )
        )

        result = service.send("0918359253", "Cảnh báo mưa lớn.", dry_run=False)

        request = mocked_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["phoneNumbers"], ["+84918359253"])
        self.assertEqual(
            payload["textMessage"]["text"], "[TRAM BAN] Cảnh báo mưa lớn."
        )
        self.assertTrue(request.headers["Authorization"].startswith("Basic "))
        self.assertEqual(result.provider, "android")
        self.assertEqual(result.provider_message_id, "android-123")
        self.assertEqual(result.status, "Pending")
