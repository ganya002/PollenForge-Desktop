import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from server import API_KEY_MASK, AUTH_TOKEN, INSECURE_NO_AUTH, app, token_ok


class TokenOkTests(unittest.TestCase):
    def test_wrong_length_is_false_not_error(self):
        self.assertFalse(token_ok("", "abc", insecure=False))
        self.assertFalse(token_ok("ab", "abc", insecure=False))

    def test_match(self):
        self.assertTrue(token_ok("secret", "secret", insecure=False))

    def test_insecure_bypass(self):
        self.assertTrue(token_ok("", "secret", insecure=True))


class AuthGateTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.headers = {"x-nexum-token": AUTH_TOKEN} if AUTH_TOKEN else {}

    def test_health_without_token(self):
        if INSECURE_NO_AUTH:
            self.skipTest("NEXUM_INSECURE_NO_AUTH is set")
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 401)

    def test_health_wrong_length_token(self):
        if INSECURE_NO_AUTH:
            self.skipTest("NEXUM_INSECURE_NO_AUTH is set")
        res = self.client.get("/health", headers={"x-nexum-token": "nope"})
        self.assertEqual(res.status_code, 401)
        self.assertNotEqual(res.status_code, 500)

    def test_health_with_token(self):
        res = self.client.get("/health", headers=self.headers)
        self.assertEqual(res.status_code, 200)

    def test_config_masks_keys(self):
        fake = {
            "providers": {
                "openai": {"api_key": "sk-secret-value-1234", "enabled": True},
            }
        }
        with patch("server.load_config", return_value=fake):
            res = self.client.get("/config", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["providers"]["openai"]["api_key"], API_KEY_MASK)
        self.assertTrue(body["providers"]["openai"]["has_key"])
        self.assertNotIn("sk-secret-value-1234", res.text)

    def test_query_token_does_not_unlock_http(self):
        if INSECURE_NO_AUTH or not AUTH_TOKEN:
            self.skipTest("auth disabled")
        res = self.client.get(f"/health?token={AUTH_TOKEN}")
        self.assertEqual(res.status_code, 401)

    def test_websocket_ping_with_token(self):
        if INSECURE_NO_AUTH or not AUTH_TOKEN:
            self.skipTest("auth disabled")
        with self.client.websocket_connect(f"/ws?token={AUTH_TOKEN}") as ws:
            ws.send_json({"type": "ping"})
            self.assertEqual(ws.receive_json(), {"type": "pong"})

    def test_websocket_without_token_closes(self):
        if INSECURE_NO_AUTH:
            self.skipTest("NEXUM_INSECURE_NO_AUTH is set")
        with self.client.websocket_connect("/ws") as ws:
            with self.assertRaises(Exception):
                ws.send_json({"type": "ping"})
                ws.receive_json()


class SharedTokenFileTests(unittest.TestCase):
    def test_env_token_wins_over_file(self):
        import os
        import tempfile
        from pathlib import Path
        from auth_token import resolve_auth_token

        with tempfile.TemporaryDirectory() as tmp:
            token_file = Path(tmp) / "token"
            token_file.write_text("file-token-file-token", encoding="utf-8")
            env = {
                "NEXUM_AUTH_TOKEN": "env-token-env-token-env-token-env",
                "NEXUM_AUTH_TOKEN_FILE": str(token_file),
                "NEXUM_INSECURE_NO_AUTH": "",
            }
            with patch.dict(os.environ, env, clear=False):
                self.assertEqual(resolve_auth_token(), "env-token-env-token-env-token-env")

    def test_reads_existing_file(self):
        import os
        import tempfile
        from pathlib import Path
        from auth_token import resolve_auth_token

        with tempfile.TemporaryDirectory() as tmp:
            token_file = Path(tmp) / "token"
            token_file.write_text("shared-secret-token-value", encoding="utf-8")
            env = {
                "NEXUM_AUTH_TOKEN": "",
                "NEXUM_AUTH_TOKEN_FILE": str(token_file),
                "NEXUM_INSECURE_NO_AUTH": "",
            }
            with patch.dict(os.environ, env, clear=False):
                self.assertEqual(resolve_auth_token(), "shared-secret-token-value")


if __name__ == "__main__":
    unittest.main()
