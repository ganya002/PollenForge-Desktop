import asyncio
import platform
import re

_APP_NAME_RE = re.compile(r"[A-Za-z0-9 ._\-']{1,64}")
_CLOSED_APP_SCRIPT = "on run argv\n tell application (item 1 of argv) to quit\nend run"


async def open_app(name_or_path: str = "", app: str = "", path: str = "") -> dict:
    if platform.system() != "Darwin":
        return {"error": "macOS app control only available on macOS"}

    target = (name_or_path or app or "").strip()
    file_path = (path or "").strip()
    # Basic guard: reject control chars that could confuse `open`
    if target and ("\x00" in target or len(target) > 128):
        return {"error": "invalid app name"}
    if file_path and ("\x00" in file_path or len(file_path) > 512):
        return {"error": "invalid path"}

    try:
        if file_path and target:
            proc = await asyncio.create_subprocess_exec(
                "open", "-a", target, file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            return {"success": True, "app": target, "file": file_path}
        elif file_path:
            proc = await asyncio.create_subprocess_exec(
                "open", file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            return {"success": True, "file": file_path}
        elif target:
            proc = await asyncio.create_subprocess_exec(
                "open", "-a", target,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            return {"success": True, "app": target}
        else:
            return {"error": "No app or path specified"}
    except Exception as e:
        return {"error": str(e)}


async def close_app(name: str) -> dict:
    if platform.system() != "Darwin":
        return {"error": "macOS app control only available on macOS"}
    cleaned = (name or "").strip()
    if not cleaned:
        return {"error": "invalid app name"}
    if not _APP_NAME_RE.fullmatch(cleaned):
        return {"error": "invalid app name"}
    try:
        # Pass name as argv to avoid AppleScript injection (T4)
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", _CLOSED_APP_SCRIPT, cleaned,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            msg = stderr.decode(errors="ignore").strip() if stderr else ""
            return {"error": msg or f"osascript failed with code {proc.returncode}"}
        return {"success": True, "app": cleaned}
    except Exception as e:
        return {"error": str(e)}


TOOLS = [
    {"name": "open_app", "description": "Open macOS application or file", "handler": open_app,
     "params": {"name_or_path": "string (app name)", "app": "string (app name, alias)", "path": "string (file to open)"}},
    {"name": "close_app", "description": "Close macOS application", "handler": close_app,
     "params": {"name": "string"}}
]
