from pathlib import Path
import json
import os
import re
import time
import uuid
from app_paths import sessions_dir, legacy_sessions_dir

_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def _validate_id(session_id: str) -> str:
    sid = (session_id or "").strip()
    if not _ID_RE.fullmatch(sid):
        raise ValueError("invalid session id")
    return sid


def _safe_path(base: Path, sid: str) -> Path:
    # Reuse traversal defense from images.py: resolve + relative_to
    p = (base / f"{sid}.json").resolve()
    try:
        p.relative_to(base.resolve())
    except ValueError:
        raise ValueError("path escape")
    return p

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
    sid = _validate_id(session_id)
    # for_write always uses SESSIONS_DIR; legacy is read-only fallback
    current = _safe_path(SESSIONS_DIR, sid)
    if for_write or current.exists():
        return current
    # Legacy fallback: also validated and containment-checked
    legacy = _safe_path(_LEGACY_DIR, sid) if _LEGACY_DIR else current
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
                "archived": bool(meta.get("archived")),
            })
        except Exception:
            continue
    sessions.sort(key=lambda s: (0 if s.get("pinned") else 1, -(s.get("updated_at") or 0)))
    return sessions


def load_session(session_id: str) -> dict:
    _ensure_dir()
    _validate_id(session_id)
    path = _path_for(session_id)
    if not path.exists():
        raise FileNotFoundError(f"Session {_validate_id(session_id)} not found")
    return json.loads(path.read_text())


def save_session(session_id: str, messages: list, meta: dict = None):
    _ensure_dir()
    meta = meta or {}
    meta["updated_at"] = time.time()
    path = _path_for(session_id, for_write=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps({"messages": messages, "meta": meta}, indent=2))
    tmp.replace(path)


def delete_session(session_id: str):
    _ensure_dir()
    sid = _validate_id(session_id)
    for base in (SESSIONS_DIR, _LEGACY_DIR):
        try:
            path = _safe_path(base, sid)
        except ValueError:
            continue
        if path.exists():
            path.unlink()


def create_session(name: str = "Untitled", directory: str = "") -> str:
    session_id = uuid.uuid4().hex[:12]
    meta = {"name": name, "created_at": time.time()}
    if directory:
        meta["directory"] = directory
    save_session(session_id, [], meta)
    return session_id
