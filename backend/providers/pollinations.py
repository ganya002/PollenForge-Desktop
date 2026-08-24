from .base import Provider
import httpx
from collections.abc import AsyncGenerator

from openai_tools import attach_openai_tools, stream_openai_chat
from pollinations_models import map_pollinations_models

ACCOUNT_KEY_URL = "https://gen.pollinations.ai/account/key"
ACCOUNT_BALANCE_URL = "https://gen.pollinations.ai/account/balance"


def pollinations_headers(api_key: str) -> dict:
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://github.com/ganya002/PollenForge-Desktop",
        "User-Agent": "Nexum",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


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
        api_key = (params.get("api_key") or "").strip()
        if not api_key:
            raise Exception(
                "Pollinations API key required. Add a secret key (sk_…) in Settings → Providers, then Save."
            )
        payload = attach_openai_tools({
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 4096)
        }, params)
        async for item in stream_openai_chat(self.API_URL, pollinations_headers(api_key), payload):
            yield item

    async def list_models(self) -> list[dict]:
        try:
            from config import resolve_provider_api_key
            api_key = resolve_provider_api_key("pollinations")
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    "https://gen.pollinations.ai/v1/models",
                    headers=pollinations_headers(api_key),
                )
                if r.status_code == 200:
                    mapped = map_pollinations_models(r.json())
                    if mapped:
                        self.models = mapped
                        return mapped
        except Exception:
            pass
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        info = await inspect_pollinations_key(api_key)
        return bool(info.get("connected"))


async def inspect_pollinations_key(api_key: str) -> dict:
    key = (api_key or "").strip()
    if not key:
        return {"connected": False, "error": "No API key"}
    headers = pollinations_headers(key)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            key_resp = await client.get(ACCOUNT_KEY_URL, headers=headers)
            if key_resp.status_code == 401:
                return {
                    "connected": False,
                    "error": "Invalid API key",
                    "status": 401,
                }
            if key_resp.status_code == 403:
                # Key is accepted for generation; account endpoints may be scoped off.
                return {"connected": True, "balance": None, "status": 403}
            if key_resp.status_code != 200:
                return {
                    "connected": False,
                    "error": f"API returned {key_resp.status_code}",
                    "status": key_resp.status_code,
                }
            info = key_resp.json() if key_resp.content else {}
            if not isinstance(info, dict):
                info = {}
            if info.get("valid") is False:
                return {"connected": False, "error": "API key is not valid", **info}

            balance = info.get("pollenBudget")
            try:
                bal_resp = await client.get(ACCOUNT_BALANCE_URL, headers=headers)
                if bal_resp.status_code == 200:
                    data = bal_resp.json() if bal_resp.content else {}
                    if isinstance(data, dict) and data.get("balance") is not None:
                        balance = data.get("balance")
            except Exception:
                pass

            return {
                "connected": True,
                "balance": balance,
                "type": info.get("type"),
                "name": info.get("name"),
            }
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


PROVIDER = PollinationsProvider()
