import unittest

from agent_loop import (
    MAX_NUDGES,
    call_key,
    filter_tool_calls,
    remember_result,
    repeat_nudge_text,
    result_failed,
    should_keep_going,
)


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
            MAX_NUDGES,
        ))

    def test_done_answer_can_stop(self):
        self.assertFalse(should_keep_going(
            "Done. The paddle now collides with the ball.",
            [],
            ["edit_file"],
            "fix collisions",
            0,
        ))


class RepeatFilterTests(unittest.TestCase):
    def test_skips_a_call_that_already_failed(self):
        failed = {call_key("run_command", {"command": "npm test"}): "exit 1"}
        to_run, skipped = filter_tool_calls(
            [{"name": "run_command", "args": {"command": "npm test"}}],
            failed,
            {},
        )
        self.assertEqual(to_run, [])
        self.assertEqual(skipped[0]["name"], "run_command")

    def test_skips_a_successful_call_the_second_time(self):
        key = call_key("read_file", {"path": "/tmp/a.py"})
        to_run, skipped = filter_tool_calls(
            [{"name": "read_file", "args": {"path": "/tmp/a.py"}}],
            {},
            {key: 1},
        )
        self.assertEqual(to_run, [])
        self.assertTrue(skipped)

    def test_allows_a_new_call(self):
        to_run, skipped = filter_tool_calls(
            [{"name": "write_file", "args": {"path": "/tmp/a.py", "content": "x"}}],
            {},
            {},
        )
        self.assertEqual(len(to_run), 1)
        self.assertEqual(skipped, [])

    def test_failed_result_is_remembered(self):
        failed: dict[str, str] = {}
        counts: dict[str, int] = {}
        key = call_key("edit_file", {"path": "a"})
        remember_result(key, {"error": "old string not found"}, failed, counts)
        self.assertIn(key, failed)
        self.assertEqual(counts, {})

    def test_ok_result_is_counted(self):
        failed: dict[str, str] = {}
        counts: dict[str, int] = {}
        key = call_key("write_file", {"path": "a"})
        remember_result(key, {"success": True}, failed, counts)
        self.assertEqual(counts[key], 1)
        self.assertNotIn(key, failed)

    def test_exit_code_counts_as_failure(self):
        self.assertTrue(result_failed({"stdout": "nope", "exit_code": 1}))
        self.assertFalse(result_failed({"stdout": "ok", "exit_code": 0}))

    def test_repeat_nudge_lists_the_skipped_tools(self):
        text = repeat_nudge_text([{"name": "read_file", "reason": "already ran with the same arguments"}])
        self.assertIn("read_file", text)
        self.assertIn("Do not repeat", text)


class ProgressTests(unittest.TestCase):
    def test_percent_moves_with_tools_and_writes(self):
        from agent_loop import progress_percent, tool_path_from_args, tool_phase
        start = progress_percent(1, 24, 0, 0)
        later = progress_percent(4, 24, 8, 3)
        self.assertGreaterEqual(start, 3)
        self.assertLess(start, later)
        self.assertLessEqual(later, 96)
        self.assertEqual(tool_phase("write_file"), "writing")
        self.assertEqual(tool_phase("read_file"), "reading")
        self.assertEqual(tool_path_from_args({"path": "/tmp/game/index.html"}), "index.html")

    def test_payload_includes_remaining_and_eta(self):
        from agent_loop import progress_payload
        payload = progress_payload(
            iteration=3,
            max_iterations=24,
            tools_executed=5,
            start_time=__import__("time").time() - 9,
            phase="writing",
            current_tool="write_file",
            current_path="index.html",
            mutate_count=2,
        )
        self.assertEqual(payload["type"], "progress")
        self.assertEqual(payload["remaining_turns"], 21)
        self.assertEqual(payload["current_path"], "index.html")
        self.assertGreaterEqual(payload["percent"], 3)
        self.assertGreaterEqual(payload["eta_ms"], 0)


if __name__ == "__main__":
    unittest.main()
