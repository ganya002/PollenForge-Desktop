import unittest

from agent_loop import should_keep_going


class AgentLoopTests(unittest.TestCase):
    def test_narration_without_tools_keeps_going(self):
        self.assertTrue(should_keep_going(
            "Let me read the full HTML file first:",
            [],
            ["read_file"],
            "build a bullet hell game",
            0,
        ))

    def test_real_tool_calls_do_not_nudge(self):
        self.assertFalse(should_keep_going(
            "Writing the player next",
            [{"name": "write_file", "args": {}}],
            ["read_file"],
            "build a game",
            0,
        ))

    def test_explore_then_build_request_keeps_going(self):
        self.assertTrue(should_keep_going(
            "The folder has index.html.",
            [],
            ["list_dir", "read_file"],
            "Create a bullet hell game",
            1,
        ))

    def test_caps_nudges(self):
        self.assertFalse(should_keep_going(
            "Let me continue",
            [],
            ["read_file"],
            "make an app",
            3,
        ))

    def test_done_answer_can_stop(self):
        self.assertFalse(should_keep_going(
            "Done. The paddle now collides with the ball.",
            [],
            ["edit_file"],
            "fix collisions",
            0,
        ))


if __name__ == "__main__":
    unittest.main()
