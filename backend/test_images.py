import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.images import generate_image, resolve_generated_image, _resolve_save_path


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


class FakeResponse:
    def __init__(self, status=200, content=PNG, headers=None, text="", json_data=None):
        self.status_code = status
        self.content = content
        self.headers = headers or {"content-type": "image/png"}
        self.text = text
        self._json = json_data

    def json(self):
        if self._json is not None:
            return self._json
        raise ValueError("no json")


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, params=None, headers=None):
        return FakeResponse()


class ImageToolTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_key(self):
        with patch("config.resolve_provider_api_key", return_value=""):
            result = await generate_image("a cat")
        self.assertIn("API key", result.get("error", ""))

    async def test_prompt_required(self):
        result = await generate_image("")
        self.assertEqual(result.get("error"), "prompt is required")

    async def test_saves_image_and_returns_media_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "generated-images"
            folder.mkdir()
            with patch("tools.images.generated_images_dir", return_value=folder):
                with patch("config.resolve_provider_api_key", return_value="sk_test"):
                    with patch("tools.images.httpx.AsyncClient", FakeAsyncClient):
                        result = await generate_image("a red bicycle")
            self.assertTrue(result.get("success"))
            self.assertTrue(result["url"].startswith("http://127.0.0.1:8765/media/"))
            self.assertTrue(Path(result["path"]).is_file())
            self.assertEqual(Path(result["path"]).read_bytes(), PNG)
            with patch("tools.images.generated_images_dir", return_value=folder):
                resolved = resolve_generated_image(result["filename"])
            self.assertEqual(resolved.resolve(), Path(result["path"]).resolve())

    async def test_save_path_copies_into_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "generated-images"
            folder.mkdir()
            workspace = Path(tmp) / "proj"
            workspace.mkdir()
            with patch("tools.images.generated_images_dir", return_value=folder):
                with patch("config.resolve_provider_api_key", return_value="sk_test"):
                    with patch("tools.images.httpx.AsyncClient", FakeAsyncClient):
                        result = await generate_image(
                            "logo",
                            save_path="nexum-images/logo.png",
                            root=str(workspace),
                        )
            dest = workspace / "nexum-images" / "logo.png"
            self.assertEqual(Path(result["saved_to"]).resolve(), dest.resolve())
            self.assertTrue(dest.is_file())

    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "generated-images"
            folder.mkdir()
            secret = Path(tmp) / "config.json"
            secret.write_text("nope", encoding="utf-8")
            with patch("tools.images.generated_images_dir", return_value=folder):
                self.assertIsNone(resolve_generated_image("../config.json"))
                self.assertIsNone(resolve_generated_image("..\\config.json"))
                self.assertIsNone(resolve_generated_image("/etc/passwd"))
                self.assertIsNone(resolve_generated_image("foo/bar.png"))
                self.assertIsNone(resolve_generated_image("missing.png"))

    def test_no_workspace_rejects_absolute_save_path(self):
        err = _resolve_save_path("/tmp/nexum-overwrite.png", None)
        self.assertIsInstance(err, dict)
        self.assertIn("relative", err.get("error", ""))

    def test_no_workspace_rejects_save_path_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "generated-images"
            folder.mkdir()
            with patch("tools.images.generated_images_dir", return_value=folder):
                err = _resolve_save_path("../secret.png", None)
            self.assertIsInstance(err, dict)
            self.assertIn("escapes", err.get("error", ""))

    def test_media_route_404_on_traversal(self):
        from fastapi.testclient import TestClient
        import server as server_module
        from server import app

        headers = {}
        if getattr(server_module, "AUTH_TOKEN", ""):
            headers["x-nexum-token"] = server_module.AUTH_TOKEN

        client = TestClient(app)
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "generated-images"
            folder.mkdir()
            with patch("tools.images.generated_images_dir", return_value=folder):
                self.assertEqual(client.get("/media/../config.json", headers=headers).status_code, 404)
                self.assertEqual(client.get("/media/%2e%2e%2fconfig.json", headers=headers).status_code, 404)
                self.assertEqual(client.get("/media/missing.png", headers=headers).status_code, 404)


if __name__ == "__main__":
    unittest.main()
