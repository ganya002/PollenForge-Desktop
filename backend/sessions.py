from pathlib import Path
import json
import time
import uuid
from app_paths import sessions_dir, legacy_sessions_dir

SESSIONS_DIR = sessions_dir()
_LEGACY_DIR = legacy_sessions_dir()


def _ensure_dir():
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def _iter_session_files() -> list[Path]:
    seen: set[str] = set()
    files: list[Path] = []
    for folder in (SESSIONS_DIR, _LEGACY_DIR):
        if not folder.exists():
            continue
        for f in folder.glob("*.json"):
            if f.stem in seen:
                continue
            seen.add(f.stem)
            files.append(f)
    return files


def _path_for(session_id: str, for_write: bool = False) -> Path:
    current = SESSIONS_DIR / f"{session_id}.json"
    if for_write or current.exists():
        return current
    legacy = _LEGACY_DIR / f"{session_id}.json"
    if legacy.exists():
        return legacy
    return current


def _user_preview(messages: list) -> str:
    for item in messages or []:
        if not isinstance(item, dict) or item.get("role") != "user":
            continue
        text = str(item.get("content") or "").strip()
        if text:
            return text[:200]
    return ""


def list_sessions() -> list[dict]:
    _ensure_dir()
    sessions = []
    for f in _iter_session_files():
        try:
            data = json.loads(f.read_text())
            meta = data.get("meta", {})
            sessions.append({
                "id": f.stem,
                "name": meta.get("name", "Untitled"),
                "message_count": len(data.get("messages", [])),
                "updated_at": meta.get("updated_at", 0),
                "directory": meta.get("directory") or "",
                "preview": _user_preview(data.get("messages", [])),
                "pinned": bool(meta.get("pinned")),
            })
        except Exception:
            continue
    sessions.sort(key=lambda s: (0 if s.get("pinned") else 1, -(s.get("updated_at") or 0)))
    return sessions


def load_session(session_id: str) -> dict:
    _ensure_dir()
    path = _path_for(session_id)
    if not path.exists():
        raise FileNotFoundError(f"Session {session_id} not found")
    return json.loads(path.read_text())


def save_session(session_id: str, messages: list, meta: dict = None):
    _ensure_dir()
    meta = meta or {}
    meta["updated_at"] = time.time()
    path = _path_for(session_id, for_write=True)
    path.write_text(json.dumps({"messages": messages, "meta": meta}, indent=2))


def delete_session(session_id: str):
    _ensure_dir()
    for path in (
        SESSIONS_DIR / f"{session_id}.json",
        _LEGACY_DIR / f"{session_id}.json",
    ):
        if path.exists():
            path.unlink()


def create_session(name: str = "Untitled", directory: str = "") -> str:
    session_id = uuid.uuid4().hex[:12]
    meta = {"name": name, "created_at": time.time()}
    if directory:
        meta["directory"] = directory
    save_session(session_id, [], meta)
    return session_id
