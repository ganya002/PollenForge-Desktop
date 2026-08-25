from .base import Provider
from vision import model_supports_vision, google_parts
import json
import httpx
from collections.abc import AsyncGenerator


class GoogleProvider(Provider):
    name = "google"
    API_BASE = "https://generativelanguage.googleapis.com/v1beta"
    models = [
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "cost_per_1k": 0.00125},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "cost_per_1k": 0.000075}
    ]

    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        api_key = params.get("api_key", "")
        if not api_key:
            raise Exception("Google API key required")

        vision = model_supports_vision(self.name, model)
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            imgs = m.get("images") or []
            if imgs and vision and m["role"] == "user":
                contents.append({"role": role, "parts": google_parts(m.get("content", ""), imgs)})
            else:
                if imgs and m["role"] == "user":
                    note = f"\n\n[{len(imgs)} image(s) attached — {model} is text-only, images not shown.]"
                    contents.append({"role": role, "parts": [{"text": m["content"] + note}]})
                else:
                    contents.append({"role": role, "parts": [{"text": m["content"]}]})

        url = f"{self.API_BASE}/models/{model}:streamGenerateContent?key={api_key}"
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": params.get("temperature", 0.7),
                "maxOutputTokens": params.get("max_tokens", 4096)
            }
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", url, json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise Exception(f"API error {response.status_code}: {body.decode()[:500]}")
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for part in parts:
                                thought = part.get("thought")
                                text = part.get("text") or ""
                                if isinstance(thought, str) and thought:
                                    yield {"type": "reasoning", "content": thought}
                                elif thought and text:
                                    yield {"type": "reasoning", "content": text}
                                elif text:
                                    yield text
                    except (json.JSONDecodeError, KeyError):
                        continue

    async def list_models(self) -> list[dict]:
        return self.models

    async def validate_key(self, api_key: str) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{self.API_BASE}/models?key={api_key}"
                )
                return r.status_code == 200
        except Exception:
            return False


PROVIDER = GoogleProvider()
