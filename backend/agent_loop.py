import json
import re
import time

EXPLORE_TOOLS = {
    "read_file",
    "list_dir",
    "read_folder",
    "search_files",
    "search_code",
    "find_files",
    "tree_view",
    "get_file_info",
    "web_search",
    "fetch_url",
}

NARRATE_RE = re.compile(
    r"\b(let me|i'll|i will|i am going to|next i|continu(?:e|ing)|"
    r"checking|reading|looking at|now i|i need to|going to|"
    r"i can see|perfect!?|great!?)\b",
    re.I,
)

BUILD_RE = re.compile(
    r"\b(creat|build|make|fix|implement|write|add|edit|refactor|"
    r"ship|finish|complete|game|app|feature|page|ui)\b",
    re.I,
)

KEEP_GOING_NUDGE = (
    "Stop narrating. Do not plan in prose. Your first character must start a ```tool block. "
    "Do not re-read the same files. Call write_file / edit_file / run_command now. "
    "If the last approach failed, change the arguments or pick a different tool."
)

WRITE_TOOLS = {"write_file", "edit_file", "delete_file"}
RUN_TOOLS = {
    "run_command",
    "run_tests",
    "run_build",
    "run_linter",
    "run_typecheck",
    "start_background_task",
}
MAX_ITERATIONS = 24

REPEAT_NUDGE = (
    "Those exact tool calls already ran or already failed. Do not repeat them. "
    "Change the arguments, pick a different tool, or write/edit files to make progress."
)

MAX_NUDGES = 4
MAX_REPEAT_NUDGES = 4
MAX_OK_RUNS = 1
MAX_TOOLS_PER_TURN = 16


def last_user_text(messages: list) -> str:
    for item in reversed(messages or []):
        if isinstance(item, dict) and item.get("role") == "user":
            return str(item.get("content") or "")
    return ""


def call_key(name: str, args: dict | None) -> str:
    payload = json.dumps(args or {}, sort_keys=True, default=str)[:400]
    return f"{name}:{payload}"


def result_failed(result: dict | None) -> bool:
    if not isinstance(result, dict):
        return True
    if result.get("error"):
        return True
    if result.get("success") is False:
        return True
    code = result.get("exit_code")
    if code not in (None, 0):
        return True
    return False


def filter_tool_calls(
    tool_calls: list | None,
    failed_keys: dict[str, str],
    run_counts: dict[str, int],
) -> tuple[list[dict], list[dict]]:
    """Split calls into ones worth running vs repeats of a failed/already-run call."""
    to_run: list[dict] = []
    skipped: list[dict] = []
    for tc in tool_calls or []:
        name = str(tc.get("name") or "")
        args = dict(tc.get("args") or {})
        key = call_key(name, args)
        if key in failed_keys:
            skipped.append({"name": name, "key": key, "reason": failed_keys[key]})
            continue
        if run_counts.get(key, 0) >= MAX_OK_RUNS:
            skipped.append({"name": name, "key": key, "reason": "already ran with the same arguments"})
            continue
        to_run.append(tc)
    return to_run, skipped


def repeat_nudge_text(skipped: list[dict]) -> str:
    lines = [REPEAT_NUDGE]
    for item in skipped[:8]:
        reason = str(item.get("reason") or "repeat")[:240]
        lines.append(f"- {item.get('name')}: {reason}")
    lines.append("Output new tool calls now.")
    return "\n".join(lines)


def remember_result(key: str, result: dict | None, failed_keys: dict[str, str], run_counts: dict[str, int]) -> None:
    if result_failed(result):
        summary = ""
        if isinstance(result, dict):
            summary = str(result.get("error") or result.get("_summary") or "failed")[:240]
        failed_keys[key] = summary or "failed"
        return
    run_counts[key] = run_counts.get(key, 0) + 1


def tool_path_from_args(args: dict | None) -> str:
    if not isinstance(args, dict):
        return ""
    for key in ("path", "file", "cwd"):
        val = args.get(key)
        if val:
            text = str(val).replace("\\", "/")
            return text.rsplit("/", 1)[-1][:120]
    url = args.get("url")
    if url:
        return str(url)[:80]
    return ""


def tool_phase(name: str) -> str:
    if name in WRITE_TOOLS:
        return "writing"
    if name in RUN_TOOLS:
        return "running"
    if name in EXPLORE_TOOLS:
        return "reading"
    return "working"


def progress_percent(
    iteration: int,
    max_iterations: int,
    tools_executed: int,
    mutate_count: int = 0,
) -> int:
    cap = max(max_iterations, 1)
    raw = (
        6
        + (max(iteration, 0) / cap) * 48
        + min(28, max(tools_executed, 0) * 3)
        + min(28, max(mutate_count, 0) * 8)
    )
    hi = 96 if iteration < cap else 98
    return int(max(3, min(hi, raw)))


def progress_payload(
    *,
    iteration: int,
    max_iterations: int,
    tools_executed: int,
    start_time: float,
    phase: str = "thinking",
    current_tool: str = "",
    current_path: str = "",
    mutate_count: int = 0,
) -> dict:
    elapsed_ms = int(max(0.0, (time.time() - start_time) * 1000))
    remaining_turns = max(0, max_iterations - iteration)
    avg_ms = elapsed_ms / max(iteration, 1)
    likely_left = remaining_turns
    if mutate_count > 0:
        likely_left = min(remaining_turns, max(1, 3))
    elif tools_executed > 0:
        likely_left = min(remaining_turns, max(2, 6))
    eta_ms = int(avg_ms * likely_left) if iteration > 0 else 0
    return {
        "type": "progress",
        "iteration": iteration,
        "max_iterations": max_iterations,
        "tools_executed": tools_executed,
        "percent": progress_percent(iteration, max_iterations, tools_executed, mutate_count),
        "remaining_turns": remaining_turns,
        "elapsed_ms": elapsed_ms,
        "eta_ms": eta_ms,
        "phase": phase,
        "current_tool": current_tool,
        "current_path": current_path,
        "mutate_count": mutate_count,
    }


def should_keep_going(
    cleaned: str,
    tool_calls: list | None,
    last_tool_names: list[str],
    user_text: str,
    nudges: int,
) -> bool:
    if tool_calls:
        return False
    if nudges >= MAX_NUDGES:
        return False
    text = cleaned or ""
    if NARRATE_RE.search(text):
        return True
    if last_tool_names and all(name in EXPLORE_TOOLS for name in last_tool_names):
        visible = user_text.split("\n---\nUser request:\n")[-1]
        if BUILD_RE.search(visible or ""):
            return True
    return False
