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
            # Hide real configs that migrate_legacy_data would copy into tmp
            candidates = [
                Path.home() / ".local" / "share" / "nexum" / "config.json",
                Path.home() / ".config" / "pollenforge" / "config.json",
                Path.home() / ".config" / "nexum" / "config.json",
            ]
            backups: list[tuple[Path, Path]] = []
            try:
                for real_cfg in candidates:
                    if real_cfg.exists():
                        backup = real_cfg.with_suffix(".bak_test_tmp")
                        # ensure unique backup name
                        i = 0
                        while backup.exists():
                            backup = real_cfg.with_suffix(f".bak_test_tmp{i}")
                            i += 1
                        real_cfg.rename(backup)
                        backups.append((real_cfg, backup))
                with patch.dict(os.environ, env, clear=False):
                    os.environ.pop("POLLINATIONS_API_KEY", None)
                    import importlib
                    import app_paths
                    import config
                    importlib.reload(app_paths)
                    importlib.reload(config)
                    self.assertEqual(config.resolve_provider_api_key("pollinations"), "sk_from_env")
            finally:
                for real_cfg, backup in backups:
                    if backup.exists():
                        try:
                            backup.rename(real_cfg)
                        except Exception:
                            pass
                # restore modules to real user data
                try:
                    import importlib
                    import app_paths
                    import config
                    importlib.reload(app_paths)
                    importlib.reload(config)
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()
