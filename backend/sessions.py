from pathlib import Path
import json
import time
import uuid

SESSIONS_DIR = Path.home() / ".local" / "share" / "pollenforge" / "sessions"


def _ensure_dir():
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def list_sessions() -> list[dict]:
    _ensure_dir()
    sessions = []
    for f in SESSIONS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            meta = data.get("meta", {})
            sessions.append({
                "id": f.stem,
                "name": meta.get("name", "Untitled"),
                "message_count": len(data.get("messages", [])),
                "updated_at": meta.get("updated_at", 0)
            })
        except Exception:
            continue
    sessions.sort(key=lambda s: s["updated_at"], reverse=True)
    return sessions


def load_session(session_id: str) -> dict:
    _ensure_dir()
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Session {session_id} not found")
    return json.loads(path.read_text())


def save_session(session_id: str, messages: list, meta: dict = None):
    _ensure_dir()
    meta = meta or {}
    meta["updated_at"] = time.time()
    path = SESSIONS_DIR / f"{session_id}.json"
    path.write_text(json.dumps({"messages": messages, "meta": meta}, indent=2))


def delete_session(session_id: str):
    _ensure_dir()
    path = SESSIONS_DIR / f"{session_id}.json"
    if path.exists():
        path.unlink()


def create_session(name: str = "Untitled") -> str:
    session_id = uuid.uuid4().hex[:12]
    save_session(session_id, [], {"name": name, "created_at": time.time()})
    return session_id
