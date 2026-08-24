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


if __name__ == "__main__":
    unittest.main()
