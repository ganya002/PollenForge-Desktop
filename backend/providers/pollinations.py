from .base import Provider
import httpx
from collections.abc import AsyncGenerator

from openai_tools import attach_openai_tools, stream_openai_chat
from pollinations_models import map_pollinations_models


class PollinationsProvider(Provider):
    name = "pollinations"
    API_URL = "https://gen.pollinations.ai/v1/chat/completions"
    models = [
        {"id": "gpt-4o", "name": "GPT-4o", "cost_per_1k": 0.0},
        {"id": "gpt-5.6-sol", "name": "GPT-5.6 Sol", "cost_per_1k": 0.0},
        {"id": "gpt-5.6-luna", "name": "GPT-5.6 Luna", "cost_per_1k": 0.0},
        {"id": "gpt-5.4-mini", "name": "GPT-5.4 Mini", "cost_per_1k": 0.0},
        {"id": "openai-large", "name": "OpenAI Large", "cost_per_1k": 0.0},
        {"id": "kimi-k3", "name": "Kimi K3", "cost_per_1k": 0.0},
        {"id": "grok-large", "name": "Grok Large", "cost_per_1k": 0.0},
        {"id": "deepseek-pro", "name": "DeepSeek Pro", "cost_per_1k": 0.0},
        {"id": "glm", "name": "GLM", "cost_per_1k": 0.0},
        {"id": "claude-hybridspace", "name": "Claude Hybridspace", "cost_per_1k": 0.0},
        {"id": "mistral", "name": "Mistral", "cost_per_1k": 0.0},
        {"id": "gemini", "name": "Gemini", "cost_per_1k": 0.0},
        {"id": "llama", "name": "Llama", "cost_per_1k": 0.0},
        {"id": "qwen-coder", "name": "Qwen Coder", "cost_per_1k": 0.0},
        {"id": "deepseek", "name": "DeepSeek", "cost_per_1k": 0.0},
        {"id": "kimi-k2.6", "name": "Kimi K2.6", "cost_per_1k": 0.0},
        {"id": "grok", "name": "Grok", "cost_per_1k": 0.0}
    ]

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        payload = attach_openai_tools({
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 4096)
        }, params)
        headers = {"Content-Type": "application/json"}
        api_key = params.get("api_key")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        async for item in stream_openai_chat(self.API_URL, headers, payload):
            yield item

    async def list_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get("https://gen.pollinations.ai/v1/models")
                if r.status_code == 200:
                    mapped = map_pollinations_models(r.json())
                    if mapped:
                        self.models = mapped
                        return mapped
        except Exception:
            pass
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        return True


PROVIDER = PollinationsProvider()
