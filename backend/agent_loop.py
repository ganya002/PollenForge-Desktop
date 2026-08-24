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
    "You paused before finishing. The user's task is not done. "
    "Output tool calls now (write_file, edit_file, or run_command as needed). "
    "Do not describe the next step — do it."
)

MAX_NUDGES = 3


def last_user_text(messages: list) -> str:
    for item in reversed(messages or []):
        if isinstance(item, dict) and item.get("role") == "user":
            return str(item.get("content") or "")
    return ""


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
