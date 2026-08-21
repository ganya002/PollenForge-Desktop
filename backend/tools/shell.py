import asyncio
import time
from .danger import is_dangerous


async def run_command(command: str, cwd: str = None, timeout: int = 30) -> dict:
    if not command or not command.strip():
        return {"error": "Command cannot be empty"}
    if len(command) > 10000:
        return {"error": "Command too long (max 10000 chars)"}
    if timeout is not None:
        try:
            timeout = int(timeout)
        except:
            timeout = 30
        timeout = max(1, min(timeout, 300))
    if cwd:
        from pathlib import Path
        p = Path(cwd).expanduser()
        if not p.exists():
            return {"error": f"cwd not found: {cwd}"}
        if not p.is_dir():
            return {"error": f"cwd is not a directory: {cwd}"}
    if is_dangerous(command):
        return {
            "error": "Command blocked: contains dangerous patterns",
            "command": command,
            "blocked": True
        }
    start = time.time()
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            try:
                proc.kill()
                await proc.wait()
            except:
                pass
            return {"error": f"Command timed out after {timeout}s", "command": command}
        elapsed = time.time() - start
        out = stdout.decode(errors="replace")
        err = stderr.decode(errors="replace")
        # Truncate large outputs
        if len(out) > 50000:
            out = out[:50000] + "\n...[truncated, total {} chars]".format(len(out))
        if len(err) > 20000:
            err = err[:20000] + "\n...[truncated]"
        return {
            "stdout": out,
            "stderr": err,
            "exit_code": proc.returncode,
            "command": command,
            "duration_ms": round(elapsed * 1000, 1),
            "cwd": cwd
        }
    except Exception as e:
        return {"error": str(e), "command": command}


TOOLS = [
    {"name": "run_command", "description": "Execute a shell command", "handler": run_command,
     "params": {"command": "string", "cwd": "string (optional)", "timeout": "number (optional)"}}
]
