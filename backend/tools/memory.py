import json
import time
import uuid
from pathlib import Path

from app_paths import data_dir

MAX_ITEMS = 40
MAX_TEXT = 400


def memory_file() -> Path:
    path = data_dir() / "memory.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def load_memories() -> list[dict]:
    path = memory_file()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    out = []
    for item in items:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        out.append({
            "id": str(item.get("id") or uuid.uuid4().hex[:10]),
            "text": text[:MAX_TEXT],
            "created_at": item.get("created_at") or time.time(),
        })
    return out[:MAX_ITEMS]


def save_memories(items: list[dict]) -> None:
    memory_file().write_text(
        json.dumps({"items": items[:MAX_ITEMS]}, indent=2),
        encoding="utf-8",
    )


def remember(text: str = "", note: str = "") -> dict:
    value = str(text or note or "").strip()
    if not value:
        return {"error": "Memory text is required"}
    value = value[:MAX_TEXT]
    items = load_memories()
    for item in items:
        if item["text"].lower() == value.lower():
            return {"success": True, "id": item["id"], "duplicate": True, "text": item["text"]}
    entry = {"id": uuid.uuid4().hex[:10], "text": value, "created_at": time.time()}
    items.insert(0, entry)
    save_memories(items[:MAX_ITEMS])
    return {"success": True, "id": entry["id"], "text": value, "count": min(len(items), MAX_ITEMS)}


def forget_memory(memory_id: str = "", text: str = "", id: str = "") -> dict:
    needle = str(memory_id or id or text or "").strip().lower()
    if not needle:
        return {"error": "id or text is required"}
    items = load_memories()
    kept = []
    removed = []
    for item in items:
        if item["id"].lower() == needle or needle in item["text"].lower():
            removed.append(item)
        else:
            kept.append(item)
    if not removed:
        return {"error": "No matching memory"}
    save_memories(kept)
    return {"success": True, "removed": len(removed), "count": len(kept)}


def list_memories() -> dict:
    items = load_memories()
    return {"memories": items, "count": len(items)}


def memory_prompt_section() -> str:
    items = load_memories()
    if not items:
        return ""
    lines = [f"- ({item['id']}) {item['text']}" for item in items[:20]]
    return (
        "\n## Memory\n\n"
        "Durable notes about this user and their projects. Use them. "
        "Save lasting preferences with remember. Delete outdated ones with forget_memory.\n\n"
        + "\n".join(lines)
        + "\n"
    )


TOOLS = [
    {
        "name": "remember",
        "description": "Save a lasting note about the user, project, or preference. Survives across chats.",
        "params": {"text": "Short note to remember (one fact or preference)"},
        "handler": remember,
    },
    {
        "name": "list_memories",
        "description": "List saved memory notes",
        "params": {},
        "handler": list_memories,
    },
    {
        "name": "forget_memory",
        "description": "Delete a memory by id or matching text",
        "params": {"memory_id": "Memory id (optional)", "text": "Substring to match (optional)"},
        "handler": forget_memory,
    },
]
