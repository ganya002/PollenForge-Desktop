from pathlib import Path
import os
import fnmatch

BASE_DIR = Path.cwd()
SKIP_NAMES = {".git", "node_modules", "__pycache__", ".venv", "dist-electron"}


def _base(root: str | None = None) -> Path:
    if root:
        p = Path(root).expanduser()
        try:
            resolved = p.resolve()
            if resolved.is_dir():
                return resolved
        except OSError:
            pass
    return BASE_DIR


def _resolve(path_str: str, root: str | None = None) -> Path:
    p = Path(path_str).expanduser()
    if not p.is_absolute():
        p = _base(root) / p
    return p.resolve()


def read_file(path: str, max_chars: int = 50000, root: str | None = None) -> dict:
    target = _resolve(path, root)
    if not target.exists():
        return {"error": f"File not found: {target}"}
    if not target.is_file():
        return {"error": f"Not a file: {target}"}
    try:
        full_content = target.read_text(errors="replace")
        truncated = len(full_content) > max_chars
        content = full_content[:max_chars] if truncated else full_content
        return {
            "content": content,
            "path": str(target),
            "truncated": truncated,
            "total_chars": len(full_content)
        }
    except Exception as e:
        return {"error": str(e)}


def write_file(path: str, content: str, root: str | None = None) -> dict:
    if not path or "\x00" in path:
        return {"error": "Invalid path"}
    if len(content) > 10_000_000:
        return {"error": "Content too large (max 10MB)"}
    target = _resolve(path, root)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        return {"success": True, "path": str(target), "bytes_written": len(content.encode())}
    except Exception as e:
        return {"error": str(e)}


def edit_file(path: str, old: str, new: str, replace_all: bool = False, root: str | None = None) -> dict:
    if not path or "\x00" in path:
        return {"error": "Invalid path"}
    if old == "":
        return {"error": "Old text cannot be empty"}
    target = _resolve(path, root)
    if not target.exists():
        return {"error": f"File not found: {target}"}
    try:
        content = target.read_text(errors="replace")
        if old not in content:
            return {"error": "Old text not found in file"}
        if len(content) > 10_000_000:
            return {"error": "File too large to edit (max 10MB)"}
        if replace_all:
            content = content.replace(old, new)
        else:
            content = content.replace(old, new, 1)
        target.write_text(content)
        return {"success": True, "path": str(target)}
    except Exception as e:
        return {"error": str(e)}


def list_dir(path: str = ".", max_entries: int = 200, root: str | None = None) -> dict:
    target = _resolve(path, root)
    if not target.exists():
        return {"error": f"Directory not found: {target}"}
    if not target.is_dir():
        return {"error": f"Not a directory: {target}"}
    try:
        entries = []
        git_status = {}
        try:
            import subprocess
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(target), capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.strip().split("\n"):
                if line and len(line) > 3:
                    status_code = line[:2].strip()
                    file_path = line[3:].strip()
                    if status_code == "M" or status_code == "MM":
                        git_status[file_path] = "modified"
                    elif status_code == "A" or status_code == "AM":
                        git_status[file_path] = "new"
                    elif status_code == "D":
                        git_status[file_path] = "deleted"
                    elif status_code == "??":
                        git_status[file_path] = "untracked"
        except Exception:
            pass

        for i, item in enumerate(sorted(target.iterdir())):
            if item.name in SKIP_NAMES:
                continue
            if i >= max_entries:
                break
            stat = item.stat()
            entry = {
                "name": item.name,
                "path": str(item),
                "is_dir": item.is_dir(),
                "size": stat.st_size if not item.is_dir() else None,
                "modified": stat.st_mtime
            }
            rel_path = str(item.relative_to(target))
            if rel_path in git_status:
                entry["git_status"] = git_status[rel_path]
            if item.is_dir():
                try:
                    entry["child_count"] = len(list(item.iterdir()))
                except PermissionError:
                    entry["child_count"] = "?"
            entries.append(entry)
        return {"entries": entries, "count": len(entries), "path": str(target)}
    except Exception as e:
        return {"error": str(e)}


def search_files(path: str, pattern: str, root: str | None = None) -> dict:
    target = _resolve(path, root)
    if not target.exists():
        return {"error": f"Path not found: {target}"}
    matches = []
    root_dir = target if target.is_dir() else target.parent
    for item in root_dir.rglob("*"):
        if len(matches) >= 100:
            break
        if fnmatch.fnmatch(item.name, pattern):
            matches.append({
                "path": str(item),
                "is_dir": item.is_dir(),
                "name": item.name
            })
    return {"matches": matches, "count": len(matches)}


def read_folder(path: str = ".", max_files: int = 50, root: str | None = None) -> dict:
    target = _resolve(path, root)
    if not target.exists():
        return {"error": f"Folder not found: {target}"}
    files = []
    count = 0
    for item in target.rglob("*"):
        if count >= max_files:
            break
        if item.is_file():
            try:
                content = item.read_text(errors="replace")
                files.append({
                    "path": str(item),
                    "content": content[:10000],
                    "truncated": len(content) > 10000
                })
                count += 1
            except Exception:
                continue
    return {"files": files, "count": count, "path": str(target)}


TOOLS = [
    {"name": "read_file", "description": "Read file contents", "handler": read_file,
     "params": {"path": "string", "max_chars": "number (optional, default 50000)"}},
    {"name": "write_file", "description": "Write content to file", "handler": write_file,
     "params": {"path": "string", "content": "string"}},
    {"name": "edit_file", "description": "Find and replace in file", "handler": edit_file,
     "params": {"path": "string", "old": "string", "new": "string", "replace_all": "boolean (optional)"}},
    {"name": "list_dir", "description": "List directory contents", "handler": list_dir,
     "params": {"path": "string (optional)", "max_entries": "number (optional)"}},
    {"name": "search_files", "description": "Search files by glob pattern", "handler": search_files,
     "params": {"path": "string", "pattern": "string"}},
    {"name": "read_folder", "description": "Read all files in directory", "handler": read_folder,
     "params": {"path": "string (optional)", "max_files": "number (optional)"}}
]
