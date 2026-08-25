import json
import re

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
    "The user's task is not done. Do not re-read the same files. "
    "Output write_file / edit_file / run_command now and make the change. "
    "If the last approach failed, use different arguments or a different tool."
)

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
