from pathlib import Path
import importlib
import pkgutil

TOOL_MODULES = {}


def _discover_tools():
    package_dir = Path(__file__).parent
    for _, name, _ in pkgutil.iter_modules([str(package_dir)]):
        if name.startswith("_"):
            continue
        mod = importlib.import_module(f"tools.{name}")
        if hasattr(mod, "TOOLS"):
            for tool in mod.TOOLS:
                TOOL_MODULES[tool["name"]] = tool


def get_tool(name: str) -> dict | None:
    if not TOOL_MODULES:
        _discover_tools()
    return TOOL_MODULES.get(name)


def list_tools() -> list[dict]:
    if not TOOL_MODULES:
        _discover_tools()
    return list(TOOL_MODULES.values())


import inspect
import asyncio

# --- T3: Capability-based categories — every tool mapped exactly once ---------------
# READ = no mutation, NETWORK = read from network, WRITE = mutates files/state,
# EXEC = runs code/shell/tests, SYSTEM = OS app control
TOOL_CATEGORIES: dict[str, str] = {
    # READ
    "analyze_dependencies": "READ",
    "count_lines": "READ",
    "file_diff": "READ",
    "find_files": "READ",
    "find_functions": "READ",
    "get_file_info": "READ",
    "git_blame": "READ",
    "git_branch": "READ",
    "git_diff": "READ",
    "git_diff_staged": "READ",
    "git_log": "READ",
    "git_status": "READ",
    "list_conventions": "READ",
    "list_dir": "READ",
    "list_memories": "READ",
    "list_skills": "READ",
    "list_tasks": "READ",
    "get_skill": "READ",
    "get_task": "READ",
    "get_task_logs": "READ",
    "read_file": "READ",
    "read_folder": "READ",
    "search_code": "READ",
    "search_files": "READ",
    "show_diff": "READ",
    "tree_view": "READ",
    "run_skill": "READ",
    "worktree_list": "READ",
    # NETWORK (read-only network)
    "fetch_url": "NETWORK",
    "web_search": "NETWORK",
    "github_get_file": "NETWORK",
    "github_get_pr": "NETWORK",
    "github_list_issues": "NETWORK",
    "github_list_prs": "NETWORK",
    "github_list_repos": "NETWORK",
    "github_search_code": "NETWORK",
    # WRITE (mutates files, git, skills, memory, tasks)
    "apply_patch": "WRITE",
    "clear_tasks": "WRITE",
    "delete_file": "WRITE",
    "delete_skill": "WRITE",
    "edit_file": "WRITE",
    "forget_memory": "WRITE",
    "generate_image": "WRITE",  # gated only when save_path set (checked in requires_approval)
    "git_add": "WRITE",
    "git_checkout": "WRITE",
    "git_clone": "WRITE",
    "git_commit": "WRITE",
    "git_ignore": "WRITE",
    "git_pull": "WRITE",
    "git_push": "WRITE",
    "git_stash": "WRITE",
    "github_clone": "WRITE",
    "github_create_issue": "WRITE",
    "github_create_pr": "WRITE",
    "github_review_pr": "WRITE",
    "remember": "WRITE",
    "revert_file": "WRITE",
    "save_skill": "WRITE",
    "teach_convention": "WRITE",
    "worktree_add": "WRITE",
    "worktree_prune": "WRITE",
    "worktree_remove": "WRITE",
    "write_file": "WRITE",
    # EXEC
    "cancel_task": "EXEC",
    "check_test_coverage": "EXEC",
    "run_build": "EXEC",
    "run_command": "EXEC",
    "run_dependency_audit": "EXEC",
    "run_formatter": "EXEC",
    "run_linter": "EXEC",
    "run_security_scan": "EXEC",
    "run_tests": "EXEC",
    "run_typecheck": "EXEC",
    "spawn_swarm": "EXEC",
    "start_background_task": "EXEC",
    # SYSTEM
    "close_app": "SYSTEM",
    "open_app": "SYSTEM",
}

# Tools that do heavy disk/network IO and must not block the event loop
BLOCKING_TOOLS = {"search_code", "find_files", "count_lines", "find_functions", "analyze_dependencies", "get_file_info", "tree_view", "search_files", "read_folder", "list_dir", "read_file"}

# T3 speed-tuned approval set (opencode-parity): prompt only for shell-like exec,
# destructive file/git ops, and quitting apps. Benign writes (remember, git_add,
# skills, tests/lint/typecheck) run without prompts so the agent stays fast.
APPROVAL_REQUIRED_TOOLS: set[str] = {
    # EXEC — anything that runs arbitrary code or spawns agents
    "run_command", "start_background_task", "spawn_swarm", "run_build",
    # WRITE — destructive or history-changing
    "write_file", "edit_file", "delete_file", "apply_patch", "revert_file",
    "git_commit", "git_push", "git_checkout", "git_clone",
    "worktree_remove", "worktree_prune", "clear_tasks",
    # SYSTEM
    "close_app",
}


def requires_approval(tool: str, args: dict | None = None, auto_approve: bool = False) -> bool:
    """Single choke point for approval (T3). Used by the WS agent loop."""
    if auto_approve:
        return False
    args = args or {}
    # generate_image only needs approval when it writes to an arbitrary path
    if tool == "generate_image":
        return bool(args.get("save_path"))
    if tool not in TOOL_CATEGORIES:
        # Unknown tool → fail closed
        return True
    return tool in APPROVAL_REQUIRED_TOOLS


def assert_all_tools_categorized() -> None:
    """Test helper: fails if any discovered tool missing from TOOL_CATEGORIES."""
    missing = []
    for t in list_tools():
        if t["name"] not in TOOL_CATEGORIES:
            missing.append(t["name"])
    if missing:
        raise AssertionError(f"Tools missing categories: {missing}")

async def execute_tool(name: str, args: dict) -> dict:
    tool = get_tool(name)
    if not tool:
        return {"error": f"Unknown tool: {name}"}
    try:
        handler = tool["handler"]
        is_coro = inspect.iscoroutinefunction(handler)
        # For blocking sync tools, run in thread pool with timeout
        if not is_coro and name in BLOCKING_TOOLS:
            try:
                result = await asyncio.wait_for(asyncio.to_thread(handler, **args), timeout=30)
            except asyncio.TimeoutError:
                return {"error": f"Tool {name} timed out after 30s (too large scope? try narrower path/pattern)", "timeout": True}
            return result if isinstance(result, dict) else {"result": result}
        result = handler(**args)
        if inspect.isawaitable(result):
            try:
                limit = 180 if name == "spawn_swarm" else 60
                result = await asyncio.wait_for(result, timeout=limit)
            except asyncio.TimeoutError:
                return {"error": f"Tool {name} timed out after {limit}s", "timeout": True}
        return result if isinstance(result, dict) else {"result": result}
    except TypeError as e:
        try:
            sig = inspect.signature(handler)
            filtered = {k: v for k, v in args.items() if k in sig.parameters}
            if inspect.iscoroutinefunction(handler):
                result = await asyncio.wait_for(handler(**filtered), timeout=60)
            else:
                result = await asyncio.wait_for(asyncio.to_thread(handler, **filtered), timeout=30)
            return result if isinstance(result, dict) else {"result": result}
        except Exception as e2:
            return {"error": str(e2)}
    except Exception as e:
        return {"error": str(e)}
