from .base import Provider
import httpx
from collections.abc import AsyncGenerator

from openai_tools import attach_openai_tools, stream_openai_chat
from openrouter_models import map_openrouter_models
from vision import normalize_messages


class OpenRouterProvider(Provider):
    name = "openrouter"
    API_URL = "https://openrouter.ai/api/v1/chat/completions"
    models = [
        {"id": "stealth/ox-alpha", "name": "Ox Alpha (OR)", "cost_per_1k": 0.0, "context_length": 1048576, "free": True},
        {"id": "anthropic/claude-sonnet-5", "name": "Claude Sonnet 5 (OR)", "cost_per_1k": 0.003, "context_length": 1000000},
        {"id": "anthropic/claude-opus-4.7", "name": "Claude Opus 4.7 (OR)", "cost_per_1k": 0.015, "context_length": 1000000},
        {"id": "anthropic/claude-haiku-4.5", "name": "Claude Haiku 4.5 (OR)", "cost_per_1k": 0.001, "context_length": 200000},
        {"id": "openai/gpt-5.6-sol", "name": "GPT-5.6 Sol (OR)", "cost_per_1k": 0.005, "context_length": 1050000},
        {"id": "openai/gpt-5.6-luna", "name": "GPT-5.6 Luna (OR)", "cost_per_1k": 0.005, "context_length": 1050000},
        {"id": "openai/gpt-5.4-mini", "name": "GPT-5.4 Mini (OR)", "cost_per_1k": 0.001, "context_length": 400000},
        {"id": "google/gemini-3.5-flash", "name": "Gemini 3.5 Flash (OR)", "cost_per_1k": 0.0001, "context_length": 1048576},
        {"id": "google/gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro (OR)", "cost_per_1k": 0.001, "context_length": 1048576},
        {"id": "deepseek/deepseek-v4-pro", "name": "DeepSeek V4 Pro (OR)", "cost_per_1k": 0.0003, "context_length": 1048576},
        {"id": "qwen/qwen3-coder", "name": "Qwen3 Coder (OR)", "cost_per_1k": 0.0003, "context_length": 262144},
        {"id": "moonshotai/kimi-k3", "name": "Kimi K3 (OR)", "cost_per_1k": 0.0006, "context_length": 1048576},
        {"id": "x-ai/grok-4.6", "name": "Grok 4.6 (OR)", "cost_per_1k": 0.003, "context_length": 128000},
        {"id": "meta-llama/llama-4-maverick", "name": "Llama 4 Maverick (OR)", "cost_per_1k": 0.0003, "context_length": 1048576},
        {"id": "perplexity/sonar-pro", "name": "Sonar Pro (OR)", "cost_per_1k": 0.001, "context_length": 200000},
    ]

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        api_key = params.get("api_key", "")
        if not api_key:
            raise Exception("OpenRouter API key required (get at https://openrouter.ai/keys)")

        # OpenRouter is OpenAI-compatible
        messages, _dropped = normalize_messages(messages, self.name, model, flavor="openai")
        payload = attach_openai_tools({
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.4),
            "max_tokens": params.get("max_tokens", 16384),
        }, params)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/ganya002/PollenForge-Desktop",
            "X-Title": "Nexum",
        }
        url = params.get("base_url") or self.API_URL
        if not url.endswith("/chat/completions"):
            url = url.rstrip("/") + "/chat/completions"

        async for item in stream_openai_chat(url, headers, payload, error_prefix="OpenRouter error"):
            yield item

    async def list_models(self) -> list[dict]:
        try:
            headers = {
                "HTTP-Referer": "https://github.com/ganya002/PollenForge-Desktop",
                "X-Title": "Nexum",
            }
            try:
                from config import load_config
                key = ((load_config().get("providers") or {}).get("openrouter") or {}).get("api_key") or ""
                if key:
                    headers["Authorization"] = f"Bearer {key}"
            except Exception:
                pass
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get("https://openrouter.ai/api/v1/models", headers=headers)
                if r.status_code == 200:
                    mapped = map_openrouter_models(r.json())
                    if mapped:
                        self.models = mapped
                        return mapped
        except Exception:
            pass
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                return r.status_code == 200
        except Exception:
            return False


PROVIDER = OpenRouterProvider()
