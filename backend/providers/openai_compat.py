from .base import Provider
from collections.abc import AsyncGenerator

from openai_tools import attach_openai_tools, stream_openai_chat
from vision import normalize_messages


class OpenAICompatProvider(Provider):
    def __init__(self, name: str, api_url: str, models: list[dict], extra_headers: dict | None = None):
        self.name = name
        self.API_URL = api_url
        self.models = models
        self.extra_headers = extra_headers or {}

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        api_key = params.get("api_key") or ""
        if not api_key:
            raise Exception(f"{self.name} API key required")

        messages, _dropped = normalize_messages(messages, self.name, model, flavor="openai")
        url = params.get("base_url") or self.API_URL
        if not str(url).endswith("/chat/completions"):
            url = str(url).rstrip("/") + "/chat/completions"

        payload = attach_openai_tools({
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.4),
            "max_tokens": params.get("max_tokens", 8192),
        }, params)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }

        async for item in stream_openai_chat(url, headers, payload, error_prefix=f"{self.name} error"):
            yield item

    async def list_models(self) -> list[dict]:
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        return bool(api_key)


PROVIDERS = [
    OpenAICompatProvider(
        "groq",
        "https://api.groq.com/openai/v1/chat/completions",
        [
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "cost_per_1k": 0},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "cost_per_1k": 0},
            {"id": "qwen/qwen3-32b", "name": "Qwen 3 32B", "cost_per_1k": 0},
        ],
    ),
    OpenAICompatProvider(
        "deepseek",
        "https://api.deepseek.com/chat/completions",
        [
            {"id": "deepseek-chat", "name": "DeepSeek Chat", "cost_per_1k": 0.00027},
            {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner", "cost_per_1k": 0.00055},
        ],
    ),
    OpenAICompatProvider(
        "xai",
        "https://api.x.ai/v1/chat/completions",
        [
            {"id": "grok-3", "name": "Grok 3", "cost_per_1k": 0.003},
            {"id": "grok-3-mini", "name": "Grok 3 Mini", "cost_per_1k": 0.0003},
            {"id": "grok-2", "name": "Grok 2", "cost_per_1k": 0.002},
        ],
    ),
    OpenAICompatProvider(
        "mistral",
        "https://api.mistral.ai/v1/chat/completions",
        [
            {"id": "mistral-large-latest", "name": "Mistral Large", "cost_per_1k": 0.002},
            {"id": "mistral-small-latest", "name": "Mistral Small", "cost_per_1k": 0.0002},
            {"id": "codestral-latest", "name": "Codestral", "cost_per_1k": 0.0003},
        ],
    ),
    OpenAICompatProvider(
        "together",
        "https://api.together.xyz/v1/chat/completions",
        [
            {"id": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "name": "Llama 3.3 70B Turbo", "cost_per_1k": 0.00088},
            {"id": "Qwen/Qwen2.5-Coder-32B-Instruct", "name": "Qwen 2.5 Coder 32B", "cost_per_1k": 0.0008},
        ],
    ),
    OpenAICompatProvider(
        "fireworks",
        "https://api.fireworks.ai/inference/v1/chat/completions",
        [
            {"id": "accounts/fireworks/models/llama-v3p3-70b-instruct", "name": "Llama 3.3 70B", "cost_per_1k": 0.0009},
            {"id": "accounts/fireworks/models/deepseek-v3", "name": "DeepSeek V3", "cost_per_1k": 0.0009},
        ],
    ),
    OpenAICompatProvider(
        "cerebras",
        "https://api.cerebras.ai/v1/chat/completions",
        [
            {"id": "llama-3.3-70b", "name": "Llama 3.3 70B", "cost_per_1k": 0},
            {"id": "qwen-3-32b", "name": "Qwen 3 32B", "cost_per_1k": 0},
        ],
    ),
    OpenAICompatProvider(
        "moonshot",
        "https://api.moonshot.ai/v1/chat/completions",
        [
            {"id": "kimi-k2-0905-preview", "name": "Kimi K2", "cost_per_1k": 0.0006},
            {"id": "moonshot-v1-128k", "name": "Moonshot v1 128k", "cost_per_1k": 0.002},
        ],
    ),
]
