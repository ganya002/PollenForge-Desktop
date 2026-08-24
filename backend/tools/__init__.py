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

# Tools that do heavy disk/network IO and must not block the event loop
BLOCKING_TOOLS = {"search_code", "find_files", "count_lines", "find_functions", "analyze_dependencies", "get_file_info", "tree_view", "search_files", "read_folder", "list_dir", "read_file"}

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
