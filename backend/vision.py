"""Vision support: let multimodal models see images attached to user messages.

Wire format (frontend → backend): user messages may carry
    images: ["data:image/png;base64,AAAA...", ...]

normalize_messages() converts those into each provider's native format and
strips images (with a note) for text-only models so requests never 400.
"""
import base64
import re

MAX_IMAGES_PER_MESSAGE = 4
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB decoded per image

_DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.*)$", re.DOTALL)

# Providers that speak the OpenAI chat/completions content-parts format
_OPENAI_FAMILY = {
    "pollinations", "openai", "openrouter", "groq", "deepseek", "xai",
    "mistral", "together", "fireworks", "cerebras", "moonshot",
}

# Model ids that cannot accept images even on multimodal-capable providers
_TEXT_ONLY_RE = re.compile(
    r"(deepseek|r1|qwen.*coder|codestral|kimi|moonshot|llama|mistral-small|"
    r"grok-2|gpt-3\.5|o1-mini|glm|sonar)",
    re.I,
)


def parse_data_url(data_url: str) -> tuple[str, bytes] | None:
    """'data:image/png;base64,AAA' → ('image/png', b'...') or None."""
    m = _DATA_URL_RE.match((data_url or "").strip())
    if not m:
        return None
    try:
        return m.group(1), base64.b64decode(m.group(2), validate=False)
    except Exception:
        return None


def model_supports_vision(provider: str, model: str) -> bool:
    if provider == "ollama":
        return bool(re.search(r"(llava|vision|vl|minicpm-v|moondream|bakllava|llama3\.2-vision|llama4)", model or "", re.I))
    if provider in ("anthropic", "google"):
        return True  # all current Claude / Gemini models accept images
    if provider in _OPENAI_FAMILY:
        return not _TEXT_ONLY_RE.search(model or "")
    return False


def _openai_content(text: str, images: list[str]) -> list[dict]:
    parts: list[dict] = []
    if text:
        parts.append({"type": "text", "text": text})
    for url in images:
        parts.append({"type": "image_url", "image_url": {"url": url}})
    return parts or [{"type": "text", "text": ""}]


def _anthropic_content(text: str, images: list[str]) -> list[dict]:
    parts: list[dict] = []
    for url in images:
        parsed = parse_data_url(url)
        if not parsed:
            continue
        media_type, data = parsed
        parts.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.b64encode(data).decode("ascii"),
            },
        })
    parts.append({"type": "text", "text": text or "(see attached image(s))"})
    return parts


def google_parts(text: str, images: list[str]) -> list[dict]:
    """Gemini inline_data parts; used directly by the Google provider."""
    parts: list[dict] = []
    for url in images:
        parsed = parse_data_url(url)
        if not parsed:
            continue
        media_type, data = parsed
        parts.append({
            "inline_data": {
                "mime_type": media_type,
                "data": base64.b64encode(data).decode("ascii"),
            }
        })
    parts.append({"text": text or "(see attached image(s))"})
    return parts


def ollama_images(images: list[str]) -> list[str]:
    out = []
    for url in images:
        parsed = parse_data_url(url)
        if parsed:
            out.append(base64.b64encode(parsed[1]).decode("ascii"))
    return out


def normalize_messages(messages: list[dict], provider: str, model: str, flavor: str = "openai") -> tuple[list[dict], int]:
    """Return (messages', dropped_count). dropped = images stripped because the
    model can't see them. flavor: openai | anthropic | google | ollama."""
    vision = model_supports_vision(provider, model)
    out: list[dict] = []
    dropped = 0
    for m in messages or []:
        images = m.get("images") or []
        if not images:
            out.append(m)
            continue
        images = [u for u in images if isinstance(u, str) and u.startswith("data:image/")][:MAX_IMAGES_PER_MESSAGE]
        for url in images:
            parsed = parse_data_url(url)
            if not parsed or len(parsed[1]) > MAX_IMAGE_BYTES:
                dropped += 1
                images = [u for u in images if u != url]
        if not isinstance(m.get("content"), str):
            out.append(m)
            continue
        text = m["content"]
        if not vision or not images:
            dropped += len(images)
            note = f"\n\n[{len(images)} image(s) attached — {model or provider} is text-only, images not shown.]" if images else ""
            out.append({k: v for k, v in m.items() if k != "images"} | {"content": text + note})
            continue
        nm = {k: v for k, v in m.items() if k != "images"}
        if flavor == "openai":
            nm["content"] = _openai_content(text, images)
        elif flavor == "anthropic":
            nm["content"] = _anthropic_content(text, images)
        elif flavor == "google":
            nm["parts"] = google_parts(text, images)
        elif flavor == "ollama":
            nm["content"] = text
            nm["images"] = ollama_images(images)
        out.append(nm)
    return out, dropped
