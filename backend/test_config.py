import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class ConfigMergeTests(unittest.TestCase):
    def test_deep_merge_keeps_api_key_on_nested_providers(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "userdata"
            dest.mkdir()
            (dest / "config.json").write_text(
                '{"providers": {"pollinations": {"api_key": "sk_live"}}}',
                encoding="utf-8",
            )
            env = {"NEXUM_USER_DATA": str(dest)}
            with patch.dict(os.environ, env, clear=False):
                import importlib
                import app_paths
                import config
                importlib.reload(app_paths)
                importlib.reload(config)
                loaded = config.load_config()
                self.assertEqual(loaded["providers"]["pollinations"]["api_key"], "sk_live")
                self.assertTrue(loaded["providers"]["pollinations"].get("enabled"))

    def test_resolve_key_strips_quotes_and_reads_env_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "userdata"
            dest.mkdir()
            (dest / ".env").write_text('POLLINATIONS_API_KEY="sk_from_env"\n', encoding="utf-8")
            env = {"NEXUM_USER_DATA": str(dest)}
            with patch.dict(os.environ, env, clear=False):
                os.environ.pop("POLLINATIONS_API_KEY", None)
                import importlib
                import app_paths
                import config
                importlib.reload(app_paths)
                importlib.reload(config)
                self.assertEqual(config.resolve_provider_api_key("pollinations"), "sk_from_env")


if __name__ == "__main__":
    unittest.main()
