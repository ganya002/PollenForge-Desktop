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


def _text_parts(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("text", "content", "summary"):
            text = value.get(key)
            if isinstance(text, str) and text:
                return text
        return ""
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(_text_parts(item))
        return "".join(parts)
    return ""


def _split_content_parts(value) -> tuple[str, str]:
    if not isinstance(value, list):
        return _text_parts(value), ""
    content: list[str] = []
    reasoning: list[str] = []
    for item in value:
        if isinstance(item, str):
            content.append(item)
            continue
        if not isinstance(item, dict):
            continue
        kind = str(item.get("type") or "").lower()
        text = _text_parts(item)
        if text and ("reason" in kind or "think" in kind):
            reasoning.append(text)
        elif text:
            content.append(text)
    return "".join(content), "".join(reasoning)


def text_from_delta(delta) -> str:
    if not isinstance(delta, dict):
        return ""
    content, _ = _split_content_parts(delta.get("content"))
    return content


def reasoning_from_delta(delta) -> str:
    if not isinstance(delta, dict):
        return ""
    _, nested = _split_content_parts(delta.get("content"))
    chunks = [
        nested,
        _text_parts(delta.get("reasoning_content")),
        _text_parts(delta.get("reasoning")),
        _text_parts(delta.get("thinking")),
    ]
    details = delta.get("reasoning_details")
    if isinstance(details, list):
        for item in details:
            if not isinstance(item, dict):
                continue
            kind = str(item.get("type") or "").lower()
            if "encrypted" in kind:
                continue
            chunks.append(_text_parts(item))
    return "".join(chunk for chunk in chunks if chunk)


def apply_chat_payload(data: dict, assembler: ToolCallAssembler) -> tuple[str, str]:
    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return "", ""
    choice = choices[0]
    delta = choice.get("delta") if isinstance(choice.get("delta"), dict) else {}
    message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
    assembler.add(delta.get("tool_calls") or message.get("tool_calls"))
    content = text_from_delta(delta) or text_from_delta(message)
    reasoning = reasoning_from_delta(delta) or reasoning_from_delta(message)
    return content, reasoning


async def iter_openai_chat_sse(response: httpx.Response) -> AsyncGenerator[str | dict, None]:
    assembler = ToolCallAssembler()
    leftover: list[str] = []
    saw_sse = False
    async for line in response.aiter_lines():
        if not line:
            continue
        payload = None
        if line.startswith("data:"):
            saw_sse = True
            data_str = line[5:].strip()
            if data_str == "[DONE]":
                break
            try:
                payload = json.loads(data_str)
            except json.JSONDecodeError:
                continue
        elif not saw_sse:
            leftover.append(line)
            continue
        else:
            continue
        if not isinstance(payload, dict):
            continue
        try:
            content, reasoning = apply_chat_payload(payload, assembler)
        except (KeyError, IndexError, TypeError):
            continue
        if reasoning:
            yield {"type": "reasoning", "content": reasoning}
        if content:
            yield content
    if not saw_sse and leftover:
        try:
            payload = json.loads("".join(leftover))
            if isinstance(payload, dict):
                content, reasoning = apply_chat_payload(payload, assembler)
                if reasoning:
                    yield {"type": "reasoning", "content": reasoning}
                if content:
                    yield content
        except (json.JSONDecodeError, KeyError, IndexError, TypeError):
            pass
    calls = assembler.finalized()
    if calls:
        yield {"type": "native_tool_calls", "calls": calls}


SPEED_KEYS = ("reasoning_effort", "verbosity")


def _drop_speed_params(payload: dict) -> bool:
    changed = False
    for key in SPEED_KEYS:
        if key in payload:
            payload.pop(key, None)
            changed = True
    return changed


async def stream_openai_chat(
    url: str,
    headers: dict,
    payload: dict,
    error_prefix: str = "API error",
) -> AsyncGenerator[str | dict, None]:
    send_payload = dict(payload)
    async with httpx.AsyncClient(timeout=120.0) as client:
        last_error = None
        for attempt in range(3):
            async with client.stream("POST", url, json=send_payload, headers=headers) as response:
                if response.status_code == 200:
                    async for item in iter_openai_chat_sse(response):
                        yield item
                    return
                body = await response.aread()
                last_error = _error_message(response.status_code, body, error_prefix)
                if attempt >= 2:
                    break
                if response.status_code in (400, 422) and _drop_speed_params(send_payload):
                    continue
                if send_payload.get("tools") and _tools_rejected(response.status_code, body):
                    send_payload.pop("tools", None)
                    send_payload.pop("tool_choice", None)
                    continue
                break
        raise Exception(last_error)


def attach_openai_tools(payload: dict, params: dict) -> dict:
    tools = params.get("openai_tools") or params.get("tools")
    if tools:
        payload["tools"] = tools
        payload.setdefault("tool_choice", "auto")
    effort = params.get("reasoning_effort")
    if effort:
        payload["reasoning_effort"] = effort
    verbosity = params.get("verbosity")
    if verbosity:
        payload["verbosity"] = verbosity
    return payload
