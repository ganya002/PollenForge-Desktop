from .base import Provider
import httpx
from collections.abc import AsyncGenerator

from vision import normalize_messages
from openai_tools import attach_openai_tools, stream_openai_chat


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

        messages, _dropped = normalize_messages(messages, self.name, model, flavor="openai")
        payload = attach_openai_tools({
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 4096)
        }, params)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        async for item in stream_openai_chat(self.API_URL, headers, payload):
            yield item

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
