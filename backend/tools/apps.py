import asyncio
import platform


async def open_app(name_or_path: str = "", app: str = "", path: str = "") -> dict:
    if platform.system() != "Darwin":
        return {"error": "macOS app control only available on macOS"}

    target = name_or_path or app
    file_path = path

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
    try:
        script = f'''
        tell application "{name}"
            quit
        end tell
        '''
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
        return {"success": True, "app": name}
    except Exception as e:
        return {"error": str(e)}


TOOLS = [
    {"name": "open_app", "description": "Open macOS application or file", "handler": open_app,
     "params": {"name_or_path": "string (app name)", "app": "string (app name, alias)", "path": "string (file to open)"}},
    {"name": "close_app", "description": "Close macOS application", "handler": close_app,
     "params": {"name": "string"}}
]
