from .base import Provider
from vision import normalize_messages
import json
import httpx
from collections.abc import AsyncGenerator


class OllamaProvider(Provider):
    name = "ollama"
    DEFAULT_BASE_URL = "http://localhost:11434"
    models = []

    async def _get_base_url(self, params: dict = None) -> str:
        if params and "base_url" in params:
            return params["base_url"]
        return self.DEFAULT_BASE_URL

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        base_url = await self._get_base_url(params)
        messages, _dropped = normalize_messages(messages, self.name, model, flavor="ollama")
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": params.get("temperature", 0.7),
                "num_predict": params.get("max_tokens", 4096)
            }
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{base_url}/api/chat", json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise Exception(f"Ollama error {response.status_code}: {body.decode()[:500]}")
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        msg = data.get("message") or {}
                        thinking = msg.get("thinking") or ""
                        if thinking:
                            yield {"type": "reasoning", "content": thinking}
                        content = msg.get("content") or ""
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    async def list_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{self.DEFAULT_BASE_URL}/api/tags")
                if r.status_code == 200:
                    data = r.json()
                    models = []
                    for m in data.get("models", []):
                        models.append({
                            "id": m["name"],
                            "name": m["name"],
                            "cost_per_1k": 0.0
                        })
                    self.models = models
                    return models
        except Exception:
            pass
        return self.models or [{"id": "llama3", "name": "Llama 3", "cost_per_1k": 0.0}]

    async def validate_key(self, api_key: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{self.DEFAULT_BASE_URL}/api/tags")
                return r.status_code == 200
        except Exception:
            return False


PROVIDER = OllamaProvider()
