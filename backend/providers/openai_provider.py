from .base import Provider
import json
import httpx
from collections.abc import AsyncGenerator


class OpenAIProvider(Provider):
    name = "openai"
    API_URL = "https://api.openai.com/v1/chat/completions"
    models = [
        {"id": "gpt-4o", "name": "GPT-4o", "cost_per_1k": 0.005},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "cost_per_1k": 0.01},
        {"id": "gpt-4", "name": "GPT-4", "cost_per_1k": 0.03},
        {"id": "o1", "name": "o1", "cost_per_1k": 0.015},
        {"id": "o3-mini", "name": "o3-mini", "cost_per_1k": 0.001}
    ]

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        api_key = params.get("api_key", "")
        if not api_key:
            raise Exception("OpenAI API key required")

        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 4096)
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", self.API_URL, json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
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
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def list_models(self) -> list[dict]:
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                return r.status_code == 200
        except Exception:
            return False


PROVIDER = OpenAIProvider()
