from .base import Provider
import httpx
from collections.abc import AsyncGenerator

from openai_tools import attach_openai_tools, stream_openai_chat


class OpenRouterProvider(Provider):
    name = "openrouter"
    API_URL = "https://openrouter.ai/api/v1/chat/completions"
    # Best coding models on OpenRouter as of 2026 - curated for coding + general
    models = [
        {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4 (OR)", "cost_per_1k": 0.003, "context_length": 200000},
        {"id": "anthropic/claude-3.5-haiku", "name": "Claude 3.5 Haiku (OR)", "cost_per_1k": 0.0008, "context_length": 200000},
        {"id": "openai/gpt-4o", "name": "GPT-4o (OR)", "cost_per_1k": 0.005, "context_length": 128000},
        {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini (OR)", "cost_per_1k": 0.00015, "context_length": 128000},
        {"id": "openai/o1", "name": "o1 (OR)", "cost_per_1k": 0.015, "context_length": 128000},
        {"id": "openai/o3-mini", "name": "o3-mini (OR)", "cost_per_1k": 0.0011, "context_length": 128000},
        {"id": "deepseek/deepseek-coder", "name": "DeepSeek Coder (OR)", "cost_per_1k": 0.00014, "context_length": 128000},
        {"id": "deepseek/deepseek-v3", "name": "DeepSeek V3 (OR)", "cost_per_1k": 0.00027, "context_length": 128000},
        {"id": "qwen/qwen-2.5-coder-32b-instruct", "name": "Qwen 2.5 Coder 32B (OR)", "cost_per_1k": 0.0002, "context_length": 128000},
        {"id": "meta-llama/llama-3.1-405b-instruct", "name": "Llama 3.1 405B (OR)", "cost_per_1k": 0.003, "context_length": 128000},
        {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash (OR)", "cost_per_1k": 0.0001, "context_length": 1048576},
        {"id": "mistralai/codestral-latest", "name": "Codestral (OR)", "cost_per_1k": 0.00025, "context_length": 32000},
        {"id": "anthropic/claude-3-opus", "name": "Claude 3 Opus (OR)", "cost_per_1k": 0.015, "context_length": 200000},
        {"id": "perplexity/llama-3.1-sonar-large-128k-online", "name": "Sonar Large Online (OR)", "cost_per_1k": 0.001, "context_length": 128000},
    ]

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        api_key = params.get("api_key", "")
        if not api_key:
            raise Exception("OpenRouter API key required (get at https://openrouter.ai/keys)")

        # OpenRouter is OpenAI-compatible
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
