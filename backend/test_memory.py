import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.memory import forget_memory, list_memories, memory_prompt_section, remember
from tools.swarm import parse_swarm_tasks


class MemoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.patcher = patch("tools.memory.memory_file", return_value=Path(self.tmp.name) / "memory.json")
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_remember_and_list(self):
        saved = remember("Use uv, never pip into Homebrew")
        self.assertTrue(saved.get("success"))
        listed = list_memories()
        self.assertEqual(listed["count"], 1)
        self.assertIn("uv", listed["memories"][0]["text"])
        section = memory_prompt_section()
        self.assertIn("## Memory", section)
        self.assertIn("uv", section)

    def test_forget_by_text(self):
        remember("theme is matte black")
        out = forget_memory(text="matte")
        self.assertTrue(out.get("success"))
        self.assertEqual(list_memories()["count"], 0)


class SwarmParseTests(unittest.TestCase):
    def test_parses_json_roles(self):
        tasks = parse_swarm_tasks('[{"role":"implementer","task":"write ui"},{"role":"reviewer","task":"review ui"}]')
        self.assertEqual(len(tasks), 2)
        self.assertEqual(tasks[0]["role"], "implementer")

    def test_caps_at_three(self):
        payload = [{"task": f"job {i}"} for i in range(8)]
        self.assertEqual(len(parse_swarm_tasks(json.dumps(payload))), 3)

    def test_goal_fallback(self):
        tasks = parse_swarm_tasks("", "ship the swarm")
        self.assertEqual(tasks[0]["task"], "ship the swarm")

    def test_emit_without_handler_is_safe(self):
        import asyncio
        from tools.swarm import _emit
        asyncio.run(_emit({}, {"type": "swarm_start"}))

    def test_line_delta_from_edit_and_write(self):
        from tools.swarm import tool_line_delta
        added, removed = tool_line_delta("edit_file", {"old": "a\nb", "new": "a\nb\nc"})
        self.assertEqual((added, removed), (3, 2))
        added, removed = tool_line_delta("write_file", {"content": "one\ntwo\nthree"})
        self.assertEqual((added, removed), (3, 0))


if __name__ == "__main__":
    unittest.main()
