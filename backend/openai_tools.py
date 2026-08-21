import json
from collections.abc import AsyncGenerator, Iterable

import httpx


def _param_schema(desc) -> tuple[dict, bool]:
    text = str(desc or "string")
    lower = text.lower()
    optional = "optional" in lower
    if "boolean" in lower or "bool" in lower:
        typ = "boolean"
    elif "integer" in lower or "int" in lower:
        typ = "integer"
    elif "number" in lower or "float" in lower:
        typ = "number"
    elif "array" in lower or "list" in lower:
        typ = "array"
    else:
        typ = "string"
    return {"type": typ, "description": text}, not optional


def to_openai_tools(tools: list[dict]) -> list[dict]:
    out = []
    for tool in tools:
        name = tool.get("name")
        if not name:
            continue
        properties = {}
        required = []
        params = tool.get("params") or {}
        if isinstance(params, dict):
            for key, desc in params.items():
                schema, is_required = _param_schema(desc)
                properties[key] = schema
                if is_required:
                    required.append(key)
        out.append({
            "type": "function",
            "function": {
                "name": name,
                "description": tool.get("description") or name,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            },
        })
    return out


class ToolCallAssembler:
    def __init__(self):
        self._by_index: dict[int, dict] = {}

    def add(self, deltas: Iterable[dict] | None):
        if not deltas:
            return
        for delta in deltas:
            if not isinstance(delta, dict):
                continue
            index = delta.get("index", 0)
            slot = self._by_index.setdefault(index, {"id": "", "name": "", "arguments": ""})
            if delta.get("id"):
                slot["id"] = delta["id"]
            fn = delta.get("function") or {}
            if fn.get("name"):
                slot["name"] = fn["name"]
            if fn.get("arguments"):
                slot["arguments"] += fn["arguments"]

    def finalized(self) -> list[dict]:
        calls = []
        for index in sorted(self._by_index):
            slot = self._by_index[index]
            name = slot.get("name") or ""
            raw = (slot.get("arguments") or "").strip()
            if not name:
                continue
            if not raw:
                args = {}
            else:
                try:
                    args = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(args, dict):
                    continue
            calls.append({"name": name, "args": args, "id": slot.get("id") or f"call_{index}"})
        return calls


def prefer_native_tool_calls(text: str, native: list[dict]) -> tuple[str, list[dict]]:
    if native:
        return text, native
    from server import parse_tool_calls
    return parse_tool_calls(text)


def _error_message(status: int, body: bytes, prefix: str = "API error") -> str:
    decoded = body.decode(errors="replace")[:800]
    try:
        err = json.loads(body.decode())
        msg = err.get("error", {})
        if isinstance(msg, dict):
            msg = msg.get("message") or decoded
        elif not msg:
            msg = decoded
    except Exception:
        msg = decoded
    return f"{prefix} {status}: {msg}"


def _tools_rejected(status: int, body: bytes) -> bool:
    if status not in (400, 404, 422):
        return False
    text = body.decode(errors="replace").lower()
    return "tool" in text or "function" in text


async def iter_openai_chat_sse(response: httpx.Response) -> AsyncGenerator[str | dict, None]:
    assembler = ToolCallAssembler()
    async for line in response.aiter_lines():
        if not line or not line.startswith("data: "):
            continue
        data_str = line[6:]
        if data_str.strip() == "[DONE]":
            break
        try:
            data = json.loads(data_str)
            choices = data.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            content = delta.get("content")
            if content:
                yield content
            assembler.add(delta.get("tool_calls"))
        except (json.JSONDecodeError, KeyError, IndexError, TypeError):
            continue
    calls = assembler.finalized()
    if calls:
        yield {"type": "native_tool_calls", "calls": calls}


async def stream_openai_chat(
    url: str,
    headers: dict,
    payload: dict,
    error_prefix: str = "API error",
) -> AsyncGenerator[str | dict, None]:
    send_payload = dict(payload)
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=send_payload, headers=headers) as response:
            if response.status_code != 200:
                body = await response.aread()
                if send_payload.get("tools") and _tools_rejected(response.status_code, body):
                    send_payload.pop("tools", None)
                    send_payload.pop("tool_choice", None)
                else:
                    raise Exception(_error_message(response.status_code, body, error_prefix))
            else:
                async for item in iter_openai_chat_sse(response):
                    yield item
                return

        async with client.stream("POST", url, json=send_payload, headers=headers) as retry:
            if retry.status_code != 200:
                body = await retry.aread()
                raise Exception(_error_message(retry.status_code, body, error_prefix))
            async for item in iter_openai_chat_sse(retry):
                yield item


def attach_openai_tools(payload: dict, params: dict) -> dict:
    tools = params.get("openai_tools") or params.get("tools")
    if tools:
        payload["tools"] = tools
        payload.setdefault("tool_choice", "auto")
    return payload
