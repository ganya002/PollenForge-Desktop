import json
import asyncio
from runtime import runtime_var
from workspace import apply_workspace

MAX_AGENTS = 3
MAX_ITERS = 3
NEST_TOOLS = {"spawn_swarm"}


def parse_swarm_tasks(tasks, goal: str = "") -> list[dict]:
    raw = tasks
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            raw = []
        else:
            try:
                raw = json.loads(text)
            except json.JSONDecodeError:
                raw = [text]
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        raw = []
    out: list[dict] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append({"role": "worker", "task": item.strip()[:2000]})
        elif isinstance(item, dict):
            task = str(item.get("task") or item.get("goal") or item.get("prompt") or "").strip()
            role = str(item.get("role") or item.get("name") or "worker").strip() or "worker"
            if task:
                out.append({"role": role[:40], "task": task[:2000]})
        if len(out) >= MAX_AGENTS:
            break
    if not out and str(goal or "").strip():
        out.append({"role": "lead", "task": str(goal).strip()[:2000]})
    return out[:MAX_AGENTS]


def _collect_stream_text(item, native: list) -> str:
    if isinstance(item, dict):
        if item.get("type") == "native_tool_calls":
            native[:] = item.get("calls") or []
        return ""
    if isinstance(item, str):
        return item
    return ""


async def _emit(runtime: dict, payload: dict) -> None:
    emit = runtime.get("emit")
    if not emit:
        return
    lock = runtime.get("emit_lock")
    try:
        if lock is not None:
            async with lock:
                await emit(payload)
        else:
            await emit(payload)
    except Exception:
        pass


def tool_line_delta(name: str, args: dict) -> tuple[int, int]:
    if name == "edit_file":
        old = str(args.get("old") or "")
        new = str(args.get("new") or "")
        added = new.count("\n") + (1 if new else 0)
        removed = old.count("\n") + (1 if old else 0)
        return added, removed
    if name == "write_file":
        content = str(args.get("content") or "")
        added = content.count("\n") + (1 if content else 0)
        return added, 0
    return 0, 0


def _cancelled(runtime: dict) -> bool:
    cancel = runtime.get("cancel")
    return bool(cancel is not None and cancel.is_set())


async def _run_worker(runtime: dict, worker_id: str, role: str, task: str) -> dict:
    from openai_tools import prefer_native_tool_calls, to_openai_tools
    from tools import execute_tool, list_tools

    provider = runtime["provider"]
    model = runtime["model"]
    params = dict(runtime.get("params") or {})
    workspace = runtime.get("workspace") or ""
    ask_mode = bool(runtime.get("ask_mode"))
    tools = [t for t in list_tools() if t.get("name") not in NEST_TOOLS]
    params["openai_tools"] = to_openai_tools(tools)
    tool_names = "\n".join(f"- {t['name']}: {t['description']}" for t in tools[:40])
    agents = runtime.get("agents_section") or ""
    memory = runtime.get("memory_section") or ""
    system = f"""You are a swarm worker ({role}) for Nexum. Do only your assigned task.
Use tools. Do not spawn a swarm. Prefer the project workspace.
{f'The project folder is {workspace}.' if workspace else ''}
{agents}{memory}

Tools:
{tool_names}

Assigned task:
{task}
"""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]
    used = 0
    blocked = {
        "write_file", "edit_file", "run_command", "close_app",
        "git_commit", "git_add", "git_push", "git_checkout",
        "run_build", "start_background_task", "delete_file",
    }
    final = ""
    try:
        for _ in range(MAX_ITERS):
            if _cancelled(runtime):
                await _emit(runtime, {"type": "swarm_done", "id": worker_id, "error": "cancelled", "tools_used": used})
                return {"id": worker_id, "role": role, "task": task, "error": "cancelled", "tools_used": used}
            native: list = []
            text = ""
            async for item in provider.chat_stream(messages, model, params):
                if _cancelled(runtime):
                    await _emit(runtime, {"type": "swarm_done", "id": worker_id, "error": "cancelled", "tools_used": used})
                    return {"id": worker_id, "role": role, "task": task, "error": "cancelled", "tools_used": used}
                chunk = _collect_stream_text(item, native)
                if chunk:
                    text += chunk
                    await _emit(runtime, {"type": "swarm_token", "id": worker_id, "content": chunk})
            cleaned, calls = prefer_native_tool_calls(text, native)
            final = cleaned or text
            if not calls:
                break
            messages.append({"role": "assistant", "content": text})
            for call in calls[:6]:
                if _cancelled(runtime):
                    break
                name = call.get("name") or ""
                args = dict(call.get("args") or {})
                if workspace:
                    args = apply_workspace(name, args, workspace)
                path = str(args.get("path") or args.get("file") or "")
                added, removed = tool_line_delta(name, args)
                await _emit(runtime, {
                    "type": "swarm_tool",
                    "id": worker_id,
                    "tool": name,
                    "path": path,
                    "added": added,
                    "removed": removed,
                })
                if ask_mode and name in blocked:
                    summary = "Ask mode: writes and shell are blocked."
                else:
                    result = await execute_tool(name, args)
                    used += 1
                    summary = result.get("error") or result.get("content") or json.dumps(result)[:1500]
                    if not isinstance(summary, str):
                        summary = json.dumps(summary)[:1500]
                messages.append({"role": "user", "content": f"[Tool result for {name}]: {str(summary)[:2000]}"})
    except Exception as e:
        await _emit(runtime, {"type": "swarm_done", "id": worker_id, "error": str(e), "tools_used": used})
        return {"id": worker_id, "role": role, "task": task, "error": str(e), "tools_used": used}
    result_text = (final or "").strip()[:4000]
    await _emit(runtime, {
        "type": "swarm_done",
        "id": worker_id,
        "result": result_text,
        "tools_used": used,
    })
    return {"id": worker_id, "role": role, "task": task, "result": result_text, "tools_used": used}


async def spawn_swarm(goal: str = "", tasks: str = "") -> dict:
    runtime = runtime_var.get()
    if not runtime:
        return {"error": "Swarm can only run during a chat"}
    if runtime.get("depth", 0) >= 1:
        return {"error": "Nested swarms are not allowed"}
    parsed = parse_swarm_tasks(tasks, goal)
    if not parsed:
        return {"error": "Provide tasks as JSON: [{\"role\":\"implementer\",\"task\":\"...\"}, ...]"}
    workers = [{"id": f"s{i}", "role": item["role"], "task": item["task"]} for i, item in enumerate(parsed)]
    token = runtime_var.set({**runtime, "depth": runtime.get("depth", 0) + 1})
    try:
        await _emit(runtime, {"type": "swarm_start", "goal": goal, "workers": workers})
        results = await asyncio.gather(*[
            _run_worker(runtime, item["id"], item["role"], item["task"])
            for item in workers
        ])
        await _emit(runtime, {"type": "swarm_end"})
    finally:
        runtime_var.reset(token)
    return {
        "success": True,
        "goal": goal,
        "agents": list(results),
        "count": len(results),
    }


TOOLS = [
    {
        "name": "spawn_swarm",
        "description": "Run 2-3 parallel worker agents on split tasks, then you synthesize. Pass JSON tasks with role and task. Do not use for tiny one-file edits.",
        "params": {
            "goal": "Overall objective (optional)",
            "tasks": 'JSON array like [{"role":"implementer","task":"..."},{"role":"reviewer","task":"..."}]',
        },
        "handler": spawn_swarm,
    },
]
