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
        self.assertEqual(mapped["cost_currency"], "pollen")
        self.assertAlmostEqual(mapped["cost_in_per_1k"], 0.0004)
        self.assertAlmostEqual(mapped["cost_out_per_1k"], 0.0015)
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

    def test_chat_requires_api_key(self):
        import asyncio
        from providers.pollinations import PollinationsProvider

        async def run():
            provider = PollinationsProvider()
            with self.assertRaises(Exception) as ctx:
                async for _ in provider.chat_stream([], "openai", {}):
                    pass
            self.assertIn("API key required", str(ctx.exception))

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
