from pathlib import Path

from app_paths import user_data_dir

MAX_AGENTS_CHARS = 24000
WALK_LIMIT = 12


def _candidates_in(folder: Path) -> list[Path]:
    return [
        folder / "AGENTS.md",
        folder / ".agents" / "AGENTS.md",
        folder / ".opencode" / "AGENTS.md",
    ]


def _global_agents_files() -> list[Path]:
    return [
        Path.home() / ".config" / "nexum" / "AGENTS.md",
        user_data_dir() / "AGENTS.md",
    ]


def find_agents_file(workspace: str = "") -> Path | None:
    seen: set[str] = set()
    root = (workspace or "").strip()
    if root:
        current = Path(root).expanduser()
        try:
            current = current.resolve()
        except OSError:
            pass
        if current.is_file():
            current = current.parent
        for _ in range(WALK_LIMIT):
            key = str(current)
            if key in seen:
                break
            seen.add(key)
            for path in _candidates_in(current):
                if path.is_file():
                    return path
            git_root = (current / ".git").exists()
            parent = current.parent
            if git_root or parent == current:
                break
            current = parent
    for path in _global_agents_files():
        if path.is_file():
            return path
    return None


def load_agents_md(workspace: str = "") -> dict:
    path = find_agents_file(workspace)
    if not path:
        return {"path": "", "content": "", "truncated": False}
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {"path": "", "content": "", "truncated": False}
    truncated = len(text) > MAX_AGENTS_CHARS
    return {
        "path": str(path),
        "content": text[:MAX_AGENTS_CHARS],
        "truncated": truncated,
    }


def agents_prompt_section(loaded: dict) -> str:
    path = loaded.get("path") or ""
    content = (loaded.get("content") or "").strip()
    if not content:
        return ""
    note = ""
    if loaded.get("truncated"):
        note = (
            f"\nThis copy is truncated. Before editing the repo, read_file `{path}` "
            "so you have the rest.\n"
        )
    return f"""
## AGENTS.md — highest-priority project instructions

Loaded from `{path}`. This file outranks other style/convention notes in this prompt.
Follow it before writing files, cutting a release, or telling the user how to install or update.
Do not tell users to git clone the app; they install from GitHub Releases.
{note}
{content}
"""
