import difflib
import subprocess
from pathlib import Path
import os

def show_diff(path: str = ".", staged: bool = False, file: str = "") -> dict:
    """Show git diff or file diff."""
    try:
        target = Path(path).expanduser()
        if not target.exists():
            return {"error": f"Path not found: {path}"}
        cwd = str(target if target.is_dir() else target.parent)
        args = ["git", "diff"]
        if staged:
            args.append("--cached")
        if file:
            args.append("--")
            args.append(file)
        result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=10)
        diff_text = result.stdout
        if not diff_text and result.returncode == 0:
            return {"diff": "", "has_changes": False, "path": cwd}
        return {"diff": diff_text[:100000], "has_changes": bool(diff_text.strip()), "path": cwd, "truncated": len(diff_text) > 100000}
    except Exception as e:
        return {"error": str(e)}

def file_diff(old_path: str = "", new_path: str = "", old_content: str = "", new_content: str = "") -> dict:
    """Generate unified diff between two files or contents."""
    try:
        if old_path and new_path:
            p1 = Path(old_path).expanduser()
            p2 = Path(new_path).expanduser()
            if not p1.exists() or not p2.exists():
                return {"error": "One or both files not found"}
            a = p1.read_text(errors="replace").splitlines(keepends=True)
            b = p2.read_text(errors="replace").splitlines(keepends=True)
            name_a = str(p1)
            name_b = str(p2)
        elif old_content is not None and new_content is not None:
            a = old_content.splitlines(keepends=True)
            b = new_content.splitlines(keepends=True)
            name_a = old_path or "a"
            name_b = new_path or "b"
        else:
            return {"error": "Need old_path/new_path or old_content/new_content"}
        
        diff = difflib.unified_diff(a, b, fromfile=name_a, tofile=name_b, lineterm='')
        diff_text = "".join(diff)
        return {"diff": diff_text[:100000], "has_changes": bool(diff_text.strip()), "lines_added": sum(1 for l in diff_text.splitlines() if l.startswith('+') and not l.startswith('+++')), "lines_removed": sum(1 for l in diff_text.splitlines() if l.startswith('-') and not l.startswith('---'))}
    except Exception as e:
        return {"error": str(e)}

def apply_patch(path: str = ".", patch: str = "") -> dict:
    """Apply a unified diff patch."""
    if not patch or not patch.strip():
        return {"error": "Patch content is required"}
    try:
        target = Path(path).expanduser()
        cwd = str(target if target.is_dir() else target.parent)
        result = subprocess.run(["git", "apply", "--whitespace=nowarn", "-"], input=patch, cwd=cwd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"success": True, "path": cwd}
        # Try via patch command fallback
        result2 = subprocess.run(["patch", "-p1"], input=patch, cwd=cwd, capture_output=True, text=True, timeout=10)
        combined_err = (result.stderr + "\n" + result2.stderr).strip()
        if result2.returncode == 0:
            return {"success": True, "path": cwd}
        return {"error": combined_err[:2000] or "Patch failed to apply", "stdout": result.stdout[:2000], "stderr": combined_err[:2000]}
    except Exception as e:
        return {"error": str(e)}

def revert_file(path: str = "", file: str = "") -> dict:
    """Revert file to HEAD or discard changes."""
    try:
        p = Path(path).expanduser() if path else Path.cwd()
        target = p if p.is_dir() else p.parent
        target_file = file or (str(p) if p.is_file() else "")
        if not target_file:
            return {"error": "File is required"}
        result = subprocess.run(["git", "checkout", "HEAD", "--", target_file], cwd=str(target), capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"success": True, "file": target_file}
        # Try git restore
        result2 = subprocess.run(["git", "restore", target_file], cwd=str(target), capture_output=True, text=True, timeout=10)
        if result2.returncode == 0:
            return {"success": True, "file": target_file}
        return {"error": result.stderr or result2.stderr or "Revert failed"}
    except Exception as e:
        return {"error": str(e)}

TOOLS = [
    {"name": "show_diff", "description": "Show git diff for a repository or file. Shows unstaged changes by default.", "handler": show_diff, "params": {"path": "Repository path", "staged": "Show staged changes (boolean)", "file": "Specific file to diff"}},
    {"name": "file_diff", "description": "Generate unified diff between two files or two text contents", "handler": file_diff, "params": {"old_path": "Old file path", "new_path": "New file path", "old_content": "Old text content", "new_content": "New text content"}},
    {"name": "apply_patch", "description": "Apply a unified diff patch to a repository", "handler": apply_patch, "params": {"path": "Repository path", "patch": "Unified diff patch content"}},
    {"name": "revert_file", "description": "Revert a file to HEAD, discarding local changes", "handler": revert_file, "params": {"path": "Repository path", "file": "File to revert"}},
]
