import asyncio
import time
import uuid
import subprocess
from pathlib import Path

# In-memory task store (Codex-style background execution)
TASKS: dict[str, dict] = {}

async def _run_task(task_id: str, command: str, cwd: str, timeout: int):
    task = TASKS[task_id]
    task["status"] = "running"
    task["started_at"] = time.time()
    start = time.time()
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        task["pid"] = proc.pid
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            task["stdout"] = stdout.decode(errors="replace")[:50000]
            task["stderr"] = stderr.decode(errors="replace")[:20000]
            task["exit_code"] = proc.returncode
            task["status"] = "done" if proc.returncode == 0 else "failed"
        except asyncio.TimeoutError:
            try:
                proc.kill()
                await proc.wait()
            except:
                pass
            task["error"] = f"Timed out after {timeout}s"
            task["status"] = "timeout"
            task["exit_code"] = 124
    except Exception as e:
        task["error"] = str(e)
        task["status"] = "failed"
    finally:
        task["finished_at"] = time.time()
        task["duration_ms"] = round((time.time() - start) * 1000)

def start_background_task(command: str, cwd: str = ".", timeout: int = 300, name: str = "") -> dict:
    if not command or not command.strip():
        return {"error": "Command is required"}
    if len(command) > 10000:
        return {"error": "Command too long"}
    try:
        timeout = max(10, min(int(timeout), 3600))
    except:
        timeout = 300
    if cwd:
        p = Path(cwd).expanduser()
        if not p.exists():
            return {"error": f"cwd not found: {cwd}"}
        cwd = str(p)
    else:
        cwd = str(Path.cwd())
    task_id = uuid.uuid4().hex[:10]
    TASKS[task_id] = {
        "id": task_id,
        "name": name or command[:60],
        "command": command,
        "cwd": cwd,
        "status": "queued",
        "created_at": time.time(),
        "stdout": "",
        "stderr": "",
        "exit_code": None,
    }
    # Fire and forget
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run_task(task_id, command, cwd, timeout))
    except RuntimeError:
        # No running loop (sync call) - run via subprocess directly
        result = subprocess.run(command, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        TASKS[task_id].update({
            "stdout": result.stdout[:50000],
            "stderr": result.stderr[:20000],
            "exit_code": result.returncode,
            "status": "done" if result.returncode == 0 else "failed",
            "finished_at": time.time(),
        })
    return {"task_id": task_id, "status": "queued", "command": command, "cwd": cwd}

def get_task(task_id: str = "") -> dict:
    if not task_id:
        return {"error": "task_id is required"}
    task = TASKS.get(task_id)
    if not task:
        return {"error": f"Task {task_id} not found"}
    return {k: v for k, v in task.items()}

def list_tasks(status: str = "") -> dict:
    tasks = list(TASKS.values())
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    # Sort by created_at desc
    tasks.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    # Return summary
    summary = []
    for t in tasks[:50]:
        summary.append({
            "id": t["id"],
            "name": t["name"],
            "command": t["command"],
            "status": t["status"],
            "exit_code": t.get("exit_code"),
            "created_at": t.get("created_at"),
            "duration_ms": t.get("duration_ms"),
        })
    return {"tasks": summary, "count": len(tasks), "total": len(TASKS)}

def cancel_task(task_id: str = "") -> dict:
    if not task_id:
        return {"error": "task_id is required"}
    task = TASKS.get(task_id)
    if not task:
        return {"error": f"Task {task_id} not found"}
    if task.get("status") not in ("queued", "running"):
        return {"error": f"Task is already {task.get('status')}"}
    # Try to kill pid if exists
    pid = task.get("pid")
    if pid:
        try:
            import os, signal
            os.kill(pid, signal.SIGTERM)
        except:
            pass
    task["status"] = "cancelled"
    task["finished_at"] = time.time()
    return {"success": True, "task_id": task_id, "status": "cancelled"}

def get_task_logs(task_id: str = "", tail: int = 100) -> dict:
    if not task_id:
        return {"error": "task_id is required"}
    task = TASKS.get(task_id)
    if not task:
        return {"error": f"Task {task_id} not found"}
    try:
        tail = max(1, min(int(tail), 500))
    except:
        tail = 100
    stdout = task.get("stdout", "")
    stderr = task.get("stderr", "")
    lines_out = stdout.splitlines()[-tail:]
    lines_err = stderr.splitlines()[-tail:]
    return {
        "task_id": task_id,
        "status": task.get("status"),
        "stdout_tail": "\n".join(lines_out),
        "stderr_tail": "\n".join(lines_err),
        "exit_code": task.get("exit_code"),
        "command": task.get("command"),
    }

def clear_tasks(status: str = "") -> dict:
    if status:
        to_delete = [k for k, v in TASKS.items() if v.get("status") == status]
    else:
        to_delete = [k for k, v in TASKS.items() if v.get("status") in ("done", "failed", "cancelled", "timeout")]
    for k in to_delete:
        del TASKS[k]
    return {"cleared": len(to_delete), "remaining": len(TASKS)}

TOOLS = [
    {"name": "start_background_task", "description": "Start a command as a background task (runs while you're away, like Codex cloud). Returns task_id. Use get_task/get_task_logs to monitor.", "handler": start_background_task, "params": {"command": "Command to run", "cwd": "Working directory", "timeout": "Timeout seconds (default 300)", "name": "Task name/label"}},
    {"name": "get_task", "description": "Get status and output of a background task", "handler": get_task, "params": {"task_id": "Task ID"}},
    {"name": "list_tasks", "description": "List all background tasks", "handler": list_tasks, "params": {"status": "Filter by status (queued/running/done/failed)"}},
    {"name": "cancel_task", "description": "Cancel a running background task", "handler": cancel_task, "params": {"task_id": "Task ID"}},
    {"name": "get_task_logs", "description": "Get tail logs of a background task", "handler": get_task_logs, "params": {"task_id": "Task ID", "tail": "Number of lines (default 100)"}},
    {"name": "clear_tasks", "description": "Clear completed background tasks", "handler": clear_tasks, "params": {"status": "Only clear tasks with this status"}},
]
