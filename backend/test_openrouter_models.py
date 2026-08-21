import unittest

from openrouter_models import map_openrouter_model, map_openrouter_models


class MapOpenRouterModelTests(unittest.TestCase):
    def test_paid_chat_model_uses_live_name_and_usd(self):
        mapped = map_openrouter_model({
            "id": "openai/gpt-4o",
            "name": "OpenAI: GPT-4o",
            "context_length": 128000,
            "architecture": {"output_modalities": ["text"]},
            "pricing": {"prompt": "0.0000025", "completion": "0.00001"},
        })
        self.assertEqual(mapped["id"], "openai/gpt-4o")
        self.assertEqual(mapped["name"], "OpenAI: GPT-4o")
        self.assertFalse(mapped["free"])
        self.assertEqual(mapped["cost_currency"], "usd")
        self.assertAlmostEqual(mapped["cost_in_per_1k"], 0.0025)
        self.assertAlmostEqual(mapped["cost_out_per_1k"], 0.01)

    def test_free_suffix_is_free(self):
        mapped = map_openrouter_model({
            "id": "google/gemini-2.0-flash-exp:free",
            "name": "Google: Gemini 2.0 Flash Exp (free)",
            "pricing": {"prompt": "0", "completion": "0"},
            "architecture": {"output_modalities": ["text"]},
        })
        self.assertTrue(mapped["free"])
        self.assertEqual(mapped["cost_per_1k"], 0)

    def test_skips_image_only_and_embeddings(self):
        rows = map_openrouter_models({
            "data": [
                {
                    "id": "black-forest-labs/flux",
                    "name": "Flux",
                    "architecture": {"output_modalities": ["image"]},
                    "pricing": {"prompt": "0", "completion": "0"},
                },
                {
                    "id": "openai/text-embedding-3-large",
                    "name": "Embeddings",
                    "architecture": {"modality": "text->text", "output_modalities": ["embeddings"]},
                    "pricing": {"prompt": "0.00000013", "completion": "0"},
                },
                {
                    "id": "anthropic/claude-sonnet-4",
                    "name": "Anthropic: Claude Sonnet 4",
                    "architecture": {"output_modalities": ["text"]},
                    "pricing": {"prompt": "0.000003", "completion": "0.000015"},
                },
            ]
        })
        self.assertEqual([m["id"] for m in rows], ["anthropic/claude-sonnet-4"])


if __name__ == "__main__":
    unittest.main()
