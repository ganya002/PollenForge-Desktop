import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class AppPathsTests(unittest.TestCase):
    def test_uses_nexum_user_data_and_copies_legacy_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            dest = Path(tmp) / "userdata"
            legacy_config = home / ".config" / "nexum" / "config.json"
            legacy_config.parent.mkdir(parents=True)
            legacy_config.write_text('{"model": "kept"}', encoding="utf-8")
            session = home / ".local" / "share" / "nexum" / "sessions" / "abc.json"
            session.parent.mkdir(parents=True)
            session.write_text('{"messages": []}', encoding="utf-8")

            env = {"NEXUM_USER_DATA": str(dest)}
            with patch.dict(os.environ, env, clear=False):
                with patch("pathlib.Path.home", return_value=home):
                    import importlib
                    import app_paths
                    importlib.reload(app_paths)
                    self.assertEqual(app_paths.user_data_dir(), dest)
                    self.assertEqual(
                        (dest / "config.json").read_text(encoding="utf-8"),
                        '{"model": "kept"}',
                    )
                    self.assertTrue((dest / "sessions" / "abc.json").exists())


if __name__ == "__main__":
    unittest.main()
