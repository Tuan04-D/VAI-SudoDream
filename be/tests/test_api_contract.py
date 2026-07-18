from __future__ import annotations

import sys
from pathlib import Path
from unittest import TestCase


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app_factory import create_app  # noqa: E402


class ApiContractTests(TestCase):
    def test_critical_routes_remain_registered(self):
        paths = set(create_app().openapi()["paths"])
        expected = {
            "/health",
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/admin/users",
            "/api/forecast/{commune_id}",
            "/api/alerts",
            "/api/officer/alerts/{commune_id}/send",
        }
        self.assertTrue(expected.issubset(paths), expected - paths)

    def test_api_has_no_duplicate_operation_ids(self):
        schema = create_app().openapi()
        operation_ids = [
            operation["operationId"]
            for path in schema["paths"].values()
            for operation in path.values()
            if isinstance(operation, dict) and "operationId" in operation
        ]
        self.assertEqual(len(operation_ids), len(set(operation_ids)))
