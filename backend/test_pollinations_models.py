import unittest

from pollinations_models import map_pollinations_model, map_pollinations_models


class MapPollinationsModelTests(unittest.TestCase):
    def test_paid_chat_model(self):
        mapped = map_pollinations_model({
            "id": "gpt-5.6-sol",
            "pricing": {
                "currency": "pollen",
                "promptTextTokens": "0.0000004",
                "completionTextTokens": "0.0000015",
            },
            "context_length": 128000,
            "supported_endpoints": ["/v1/chat/completions"],
        })
        self.assertEqual(mapped["id"], "gpt-5.6-sol")
        self.assertFalse(mapped["free"])
        self.assertGreater(mapped["cost_per_1k"], 0)
        self.assertEqual(mapped["context_length"], 128000)

    def test_free_suffix_and_zero_price(self):
        mapped = map_pollinations_model({
            "id": "YoannDev90/laguna-s-2.1:free",
            "pricing": {"currency": "pollen"},
            "supported_endpoints": ["/v1/chat/completions"],
        })
        self.assertTrue(mapped["free"])
        self.assertEqual(mapped["cost_per_1k"], 0)

    def test_skips_non_chat_models(self):
        rows = map_pollinations_models({
            "data": [
                {"id": "flux", "supported_endpoints": ["/v1/images"], "pricing": {}},
                {"id": "openai", "supported_endpoints": ["/v1/chat/completions"], "pricing": {"promptTextTokens": "0.00000015", "completionTextTokens": "0.0000009"}},
            ]
        })
        self.assertEqual([m["id"] for m in rows], ["openai"])


if __name__ == "__main__":
    unittest.main()
