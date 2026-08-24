import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx

from app_paths import generated_images_dir

IMAGE_API = "https://gen.pollinations.ai/image"
MEDIA_BASE = "http://127.0.0.1:8765/media"
MAX_DIM = 2048
MIN_DIM = 64

TOOLS = [
    {
        "name": "generate_image",
        "description": (
            "Generate an image from a text prompt using Pollinations. "
            "After it returns, include ![prompt](url) in your reply using the returned url."
        ),
        "params": {
            "prompt": "Image description",
            "model": "Image model (optional, default flux)",
            "width": "Width in pixels (optional integer)",
            "height": "Height in pixels (optional integer)",
            "save_path": "Optional workspace-relative path to also save the file",
        },
        "handler": None,
    }
]


def _as_int(value, default=None, lo=MIN_DIM, hi=MAX_DIM):
    if value is None or value == "":
        return default
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _safe_stem(prompt: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", (prompt or "").strip().lower())[:40].strip("-")
    return slug or "image"


def _ext_for_content_type(content_type: str) -> str:
    ctype = (content_type or "").split(";")[0].strip().lower()
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(ctype, ".png")


def resolve_generated_image(name: str) -> Path | None:
    """Resolve a generated-image filename. Rejects path traversal."""
    if not name or not isinstance(name, str):
        return None
    if "/" in name or "\\" in name or ".." in name or name.startswith("."):
        return None
    safe = Path(name).name
    if safe != name or not safe:
        return None
    root = generated_images_dir().resolve()
    target = (root / safe).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        return None
    return target if target.is_file() else None


def _image_headers(api_key: str) -> dict:
    headers = {
        "Referer": "https://github.com/ganya002/PollenForge-Desktop",
        "User-Agent": "Nexum",
        "Accept": "image/*",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _resolve_save_path(save_path: str, root: str | None) -> Path | dict:
    from tools.filesystem import _resolve

    # T2 hardening: with no workspace open this used to accept ANY absolute
    # path, letting the agent overwrite arbitrary files with image bytes
    # without an approval prompt. Now: no-root saves are confined to the
    # generated-images folder, and traversal out of it is rejected.
    candidate = Path(str(save_path)).expanduser()
    if not root:
        if candidate.is_absolute():
            return {"error": "save_path must be relative when no workspace is open"}
        folder = generated_images_dir().resolve()
        dest = (folder / candidate).resolve()
        try:
            dest.relative_to(folder)
        except ValueError:
            return {"error": "save_path escapes the generated-images directory"}
        return dest
    dest = _resolve(save_path, root)
    if root:
        try:
            dest.relative_to(Path(root).expanduser().resolve())
        except ValueError:
            return {"error": "save_path is outside the workspace"}
    return dest


async def generate_image(
    prompt: str = "",
    model: str = "flux",
    width=None,
    height=None,
    save_path: str = "",
    root: str | None = None,
) -> dict:
    prompt = (prompt or "").strip()
    if not prompt:
        return {"error": "prompt is required"}

    from config import resolve_provider_api_key

    api_key = resolve_provider_api_key("pollinations")
    if not api_key:
        return {
            "error": "Pollinations API key required. Add a secret key (sk_…) in Settings → Providers, then Save."
        }

    model_id = (model or "flux").strip() or "flux"
    w = _as_int(width)
    h = _as_int(height)
    params = {"model": model_id}
    if w:
        params["width"] = w
    if h:
        params["height"] = h

    url = f"{IMAGE_API}/{quote(prompt, safe='')}"
    try:
        async with httpx.AsyncClient(timeout=55.0, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=_image_headers(api_key))
    except Exception as exc:
        return {"error": f"Image request failed: {exc}"}

    ctype = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    if response.status_code != 200 or not ctype.startswith("image/") or not response.content:
        detail = ""
        try:
            body = response.json()
            if isinstance(body, dict):
                detail = str(body.get("error") or body.get("message") or body)[:400]
        except Exception:
            detail = (response.text or "")[:400]
        return {
            "error": detail or f"Image API returned {response.status_code}",
            "status": response.status_code,
        }

    folder = generated_images_dir()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"{stamp}-{_safe_stem(prompt)}-{uuid.uuid4().hex[:8]}{_ext_for_content_type(ctype)}"
    dest = folder / filename
    dest.write_bytes(response.content)

    result = {
        "success": True,
        "prompt": prompt,
        "model": model_id,
        "path": str(dest),
        "url": f"{MEDIA_BASE}/{filename}",
        "filename": filename,
    }
    if w:
        result["width"] = w
    if h:
        result["height"] = h

    if save_path and str(save_path).strip():
        saved = _resolve_save_path(str(save_path).strip(), root)
        if isinstance(saved, dict):
            result["save_error"] = saved.get("error")
        else:
            try:
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(dest, saved)
                result["saved_to"] = str(saved)
            except Exception as exc:
                result["save_error"] = str(exc)
    return result


TOOLS[0]["handler"] = generate_image
