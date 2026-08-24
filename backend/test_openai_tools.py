import unittest

from openai_tools import (
    ToolCallAssembler,
    apply_chat_payload,
    prefer_native_tool_calls,
    text_from_delta,
    to_openai_tools,
)


class ToOpenAIToolsTests(unittest.TestCase):
    def test_converts_write_file_and_drops_handler(self):
        tools = to_openai_tools([
            {
                "name": "write_file",
                "description": "Write content to file",
                "handler": lambda **kwargs: None,
                "params": {"path": "string", "content": "string", "root": "string (optional)"},
            }
        ])
        self.assertEqual(len(tools), 1)
        fn = tools[0]["function"]
        self.assertEqual(tools[0]["type"], "function")
        self.assertEqual(fn["name"], "write_file")
        self.assertNotIn("handler", fn)
        self.assertEqual(fn["parameters"]["required"], ["path", "content"])
        self.assertEqual(fn["parameters"]["properties"]["path"]["type"], "string")
        self.assertEqual(fn["parameters"]["properties"]["root"]["type"], "string")


class ToolCallAssemblerTests(unittest.TestCase):
    def test_merges_streamed_argument_chunks(self):
        acc = ToolCallAssembler()
        acc.add([
            {"index": 0, "id": "call_1", "type": "function", "function": {"name": "write_file", "arguments": ""}},
        ])
        acc.add([{"index": 0, "function": {"arguments": '{"path": "index.html",'}}])
        acc.add([{"index": 0, "function": {"arguments": ' "content": "<h1>Hi</h1>"}'}}])
        calls = acc.finalized()
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["name"], "write_file")
        self.assertEqual(calls[0]["id"], "call_1")
        self.assertEqual(calls[0]["args"]["path"], "index.html")
        self.assertEqual(calls[0]["args"]["content"], "<h1>Hi</h1>")

    def test_skips_incomplete_json_arguments(self):
        acc = ToolCallAssembler()
        acc.add([{"index": 0, "id": "call_x", "function": {"name": "list_dir", "arguments": '{"path":'}}])
        self.assertEqual(acc.finalized(), [])


class PreferNativeTests(unittest.TestCase):
    def test_native_calls_win_over_empty_chat_text(self):
        native = [{"name": "write_file", "args": {"path": "a.html", "content": "x"}, "id": "c1"}]
        cleaned, calls = prefer_native_tool_calls("I'll create these files now.", native)
        self.assertEqual(cleaned, "I'll create these files now.")
        self.assertEqual(calls, native)

    def test_falls_back_to_fenced_tool_blocks(self):
        text = '```tool\n{"name": "list_dir", "args": {"path": "."}}\n```'
        cleaned, calls = prefer_native_tool_calls(text, [])
        self.assertEqual(calls[0]["name"], "list_dir")
        self.assertNotIn("```tool", cleaned)


class ReasoningAndJsonFallbackTests(unittest.TestCase):
    def test_reasoning_content_is_used_when_content_missing(self):
        self.assertEqual(text_from_delta({"reasoning_content": "thinking"}), "thinking")
        self.assertEqual(text_from_delta({"content": "answer", "reasoning_content": "hidden"}), "answer")

    def test_non_stream_message_payload(self):
        assembler = ToolCallAssembler()
        text = apply_chat_payload(
            {"choices": [{"message": {"role": "assistant", "content": "Hello there"}}]},
            assembler,
        )
        self.assertEqual(text, "Hello there")
        self.assertEqual(assembler.finalized(), [])


if __name__ == "__main__":
    unittest.main()
