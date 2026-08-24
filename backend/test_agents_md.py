import tempfile
import unittest
from pathlib import Path

from agents_md import find_agents_file, load_agents_md, agents_prompt_section


class AgentsMdTests(unittest.TestCase):
    def test_prefers_workspace_agents_over_parent(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            (root / "AGENTS.md").write_text("# parent\n", encoding="utf-8")
            child = root / "app"
            child.mkdir()
            (child / "AGENTS.md").write_text("# child\nFollow this.\n", encoding="utf-8")
            loaded = load_agents_md(str(child))
            self.assertIn("child", loaded["content"])
            self.assertNotIn("parent", loaded["content"])
            self.assertTrue(loaded["path"].endswith("AGENTS.md"))

    def test_walks_up_to_repo_root(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            (root / ".git").mkdir()
            (root / "AGENTS.md").write_text("# root rules\n", encoding="utf-8")
            nested = root / "src" / "pkg"
            nested.mkdir(parents=True)
            loaded = load_agents_md(str(nested))
            self.assertIn("root rules", loaded["content"])

    def test_missing_file_is_empty(self):
        with tempfile.TemporaryDirectory() as raw:
            from unittest.mock import patch
            with patch("agents_md._global_agents_files", return_value=[]):
                loaded = load_agents_md(str(Path(raw) / "empty"))
            self.assertEqual(loaded["content"], "")
            self.assertEqual(agents_prompt_section(loaded), "")

    def test_prompt_marks_agents_as_highest_priority(self):
        section = agents_prompt_section({"path": "/proj/AGENTS.md", "content": "No clone.", "truncated": False})
        self.assertIn("highest-priority", section)
        self.assertIn("No clone.", section)
        self.assertIn("/proj/AGENTS.md", section)


if __name__ == "__main__":
    unittest.main()
