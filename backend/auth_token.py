"""Resolve the per-launch backend auth token.

Electron and a separately started `uvicorn` must share the same secret, or the
app shows “Backend offline”. Env wins; otherwise we read (and maybe create)
~/.nexum/backend-auth-token so whichever process starts first sets the value.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path


def shared_token_path() -> Path:
    custom = (os.environ.get("NEXUM_AUTH_TOKEN_FILE") or "").strip()
    if custom:
        return Path(custom).expanduser()
    user_data = (os.environ.get("NEXUM_USER_DATA") or "").strip()
    if user_data:
        return Path(user_data) / "backend-auth-token"
    return Path.home() / ".nexum" / "backend-auth-token"


def resolve_auth_token() -> str:
    if os.environ.get("NEXUM_INSECURE_NO_AUTH") == "1":
        return ""
    env = (os.environ.get("NEXUM_AUTH_TOKEN") or "").strip()
    if env:
        return env
    path = shared_token_path()
    try:
        existing = path.read_text(encoding="utf-8").strip()
        if len(existing) >= 16:
            return existing
    except OSError:
        pass
    token = secrets.token_hex(32)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(token, encoding="utf-8")
            os.chmod(path, 0o600)
    except OSError:
        pass
    print(f"NEXUM_AUTH_TOKEN={token}", flush=True)
    return token
