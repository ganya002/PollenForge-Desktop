import unittest
import base64
from vision import (
    normalize_messages, parse_data_url, model_supports_vision,
    google_parts, ollama_images, MAX_IMAGES_PER_MESSAGE,
)

PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNGfake").decode()


def user_msg(images=None, text="hi"):
    m = {"role": "user", "content": text}
    if images is not None:
        m["images"] = images
    return m


class VisionTests(unittest.TestCase):
    def test_parse_data_url(self):
        mt, data = parse_data_url(PNG)
        self.assertEqual(mt, "image/png")
        self.assertTrue(data.startswith(b"\x89PNG"))
        self.assertIsNone(parse_data_url("http://x/y.png"))

    def test_openai_parts(self):
        out, dropped = normalize_messages([user_msg([PNG])], "pollinations", "gpt-5.6-sol")
        self.assertEqual(dropped, 0)
        c = out[0]["content"]
        self.assertEqual(c[0]["type"], "text")
        self.assertEqual(c[1]["type"], "image_url")
        self.assertEqual(c[1]["image_url"]["url"], PNG)

    def test_anthropic_source(self):
        out, dropped = normalize_messages([user_msg([PNG])], "anthropic", "claude-sonnet-4-20250514", flavor="anthropic")
        self.assertEqual(dropped, 0)
        src = out[0]["content"][0]["source"]
        self.assertEqual(src["type"], "base64")
        self.assertEqual(src["media_type"], "image/png")
        self.assertEqual(base64.b64decode(src["data"]), b"\x89PNGfake")

    def test_google_parts(self):
        parts = google_parts("look", [PNG])
        self.assertEqual(parts[0]["inline_data"]["mime_type"], "image/png")
        self.assertEqual(parts[1]["text"], "look")

    def test_ollama_raw_base64(self):
        out, _ = normalize_messages([user_msg([PNG])], "ollama", "llava", flavor="ollama")
        self.assertEqual(out[0]["images"], [base64.b64encode(b"\x89PNGfake").decode()])

    def test_text_only_model_strips_with_note(self):
        out, dropped = normalize_messages([user_msg([PNG])], "pollinations", "deepseek-pro")
        self.assertEqual(dropped, 1)
        self.assertNotIn("images", out[0])
        self.assertIn("text-only", out[0]["content"])

    def test_caps(self):
        imgs = [PNG] * (MAX_IMAGES_PER_MESSAGE + 2)
        out, _ = normalize_messages([user_msg(imgs)], "openai", "gpt-4o")
        self.assertEqual(len(out[0]["content"]) - 1, MAX_IMAGES_PER_MESSAGE)

    def test_vision_heuristics(self):
        self.assertTrue(model_supports_vision("pollinations", "gpt-5.6-sol"))
        self.assertTrue(model_supports_vision("pollinations", "claude-hybridspace"))
        self.assertTrue(model_supports_vision("pollinations", "gemini"))
        self.assertFalse(model_supports_vision("pollinations", "deepseek-pro"))
        self.assertFalse(model_supports_vision("ollama", "llama3"))
        self.assertTrue(model_supports_vision("ollama", "llava:13b"))
        self.assertTrue(model_supports_vision("anthropic", "claude-sonnet-4-20250514"))

    def test_plain_messages_untouched(self):
        msgs = [{"role": "user", "content": "no images"}, {"role": "assistant", "content": "ok"}]
        out, dropped = normalize_messages(msgs, "openai", "gpt-4o")
        self.assertEqual(dropped, 0)
        self.assertEqual(out, msgs)


if __name__ == "__main__":
    unittest.main()
