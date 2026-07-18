from __future__ import annotations

import sys
from pathlib import Path
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import config, security as auth  # noqa: E402
from infrastructure import mongo as db  # noqa: E402
from services import delivery as delivery_service  # noqa: E402


class PasswordAndPhoneTests(TestCase):
    def test_phone_is_normalized_to_e164(self):
        self.assertEqual(db.normalize_phone("0918 359 253"), "+84918359253")
        self.assertEqual(db.normalize_phone("+84 918 359 253"), "+84918359253")

    def test_invalid_phone_is_rejected(self):
        with self.assertRaises(ValueError):
            db.normalize_phone("12345")

    def test_password_uses_one_way_hash(self):
        hashed = auth.hash_password("DemoPass123")
        self.assertNotEqual(hashed, "DemoPass123")
        self.assertTrue(auth.verify_password("DemoPass123", hashed))
        self.assertFalse(auth.verify_password("wrong-password", hashed))

    def test_weak_password_is_rejected(self):
        for password in ("short1", "onlyletters", "12345678"):
            with self.subTest(password=password), self.assertRaises(ValueError):
                auth.hash_password(password)


class TokenAndRbacTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.secret_patch = patch.object(config, "JWT_SECRET_KEY", "t" * 64)
        self.secret_patch.start()
        self.user = {
            "_id": "a" * 24,
            "phone": "+84918359253",
            "display_name": "Người thử",
            "role": "resident",
            "permissions": [],
            "status": "active",
            "commune_id": "19571213",
            "token_version": 1,
        }

    def tearDown(self):
        self.secret_patch.stop()

    async def test_access_token_resolves_current_database_user(self):
        token = auth.create_access_token(self.user)
        with patch.object(db, "get_user_raw", AsyncMock(return_value=self.user)):
            current = await auth._user_from_token(token)
        self.assertEqual(current["_id"], self.user["_id"])

    async def test_token_version_revokes_old_access_token(self):
        token = auth.create_access_token(self.user)
        changed = {**self.user, "token_version": 2}
        with patch.object(db, "get_user_raw", AsyncMock(return_value=changed)):
            with self.assertRaises(HTTPException) as raised:
                await auth._user_from_token(token)
        self.assertEqual(raised.exception.status_code, 401)

    async def test_role_dependency_denies_resident(self):
        dependency = auth.require_roles("admin")
        with self.assertRaises(HTTPException) as raised:
            await dependency(self.user)
        self.assertEqual(raised.exception.status_code, 403)

    async def test_disabled_sms_still_reconciles_outbox(self):
        reconcile = AsyncMock(return_value=1)
        with (
            patch.object(config, "SMS_ENABLED", False),
            patch.object(db, "reconcile_alert_outbox", reconcile),
        ):
            result = await delivery_service.process_pending_sms()
        reconcile.assert_awaited_once()
        self.assertFalse(result["enabled"])
