from .base import Provider
import json
import httpx
from collections.abc import AsyncGenerator


class AnthropicProvider(Provider):
    name = "anthropic"
    API_URL = "https://api.anthropic.com/v1/messages"
    models = [
        {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "cost_per_1k": 0.003},
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "cost_per_1k": 0.003},
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "cost_per_1k": 0.015}
    ]

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        api_key = params.get("api_key", "")
        if not api_key:
            raise Exception("Anthropic API key required")

        system_msg = ""
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                chat_messages.append({"role": m["role"], "content": m["content"]})

        payload = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": params.get("max_tokens", 4096),
            "stream": True
        }
        if system_msg:
            payload["system"] = system_msg

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", self.API_URL, json=payload,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                }
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise Exception(f"API error {response.status_code}: {body.decode()[:500]}")
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    try:
                        data = json.loads(data_str)
                        event_type = data.get("type")
                        if event_type == "content_block_delta":
                            delta = data.get("delta") or {}
                            thought = delta.get("thinking") or ""
                            if thought:
                                yield {"type": "reasoning", "content": thought}
                            text = delta.get("text") or ""
                            if text:
                                yield text
                        elif event_type == "message_stop":
                            break
                    except (json.JSONDecodeError, KeyError):
                        continue

    async def list_models(self) -> list[dict]:
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    self.API_URL,
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "hi"}]
                    },
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    }
                )
                return r.status_code in (200, 400)
        except Exception:
            return False


PROVIDER = AnthropicProvider()
