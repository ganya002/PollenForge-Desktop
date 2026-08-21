from .base import Provider
import httpx
import json
from collections.abc import AsyncGenerator


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
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 4096)
        }
        headers = {"Content-Type": "application/json"}
        api_key = params.get("api_key")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", self.API_URL, json=payload,
                headers=headers
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
        return True


PROVIDER = PollinationsProvider()
