import subprocess
from pathlib import Path
import json
import os

def _run_git(args: list, cwd: str = ".") -> dict:
    try:
        result = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=30)
        return {"stdout": result.stdout, "stderr": result.stderr, "exit_code": result.returncode, "success": result.returncode == 0}
    except Exception as e:
        return {"error": str(e)}

def worktree_list(path: str = ".") -> dict:
    try:
        p = Path(path).expanduser()
        cwd = str(p if p.is_dir() else p.parent)
        result = subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return {"error": result.stderr.strip() or "Failed to list worktrees", "path": cwd}
        worktrees = []
        current = {}
        for line in result.stdout.splitlines():
            if line.startswith("worktree "):
                if current:
                    worktrees.append(current)
                current = {"path": line[len("worktree "):].strip()}
            elif line.startswith("HEAD "):
                current["head"] = line[len("HEAD "):].strip()
            elif line.startswith("branch "):
                current["branch"] = line[len("branch "):].strip().replace("refs/heads/", "")
            elif line.startswith("bare"):
                current["bare"] = True
            elif not line.strip():
                if current:
                    worktrees.append(current)
                    current = {}
        if current:
            worktrees.append(current)
        return {"worktrees": worktrees, "count": len(worktrees), "path": cwd}
    except Exception as e:
        return {"error": str(e)}

def worktree_add(path: str = ".", worktree_path: str = "", branch: str = "", ref: str = "") -> dict:
    if not worktree_path:
        return {"error": "worktree_path is required"}
    if not branch:
        return {"error": "branch is required"}
    try:
        p = Path(path).expanduser()
        cwd = str(p if p.is_dir() else p.parent)
        wt_path = Path(worktree_path).expanduser()
        args = ["worktree", "add"]
        if ref:
            args.extend([str(wt_path), "-b", branch, ref])
        else:
            args.extend(["-b", branch, str(wt_path)])
        result = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return {"success": True, "path": str(wt_path), "branch": branch, "stdout": result.stdout}
        return {"error": result.stderr.strip() or result.stdout.strip() or "Failed to add worktree", "exit_code": result.returncode}
    except Exception as e:
        return {"error": str(e)}

def worktree_remove(path: str = ".", worktree_path: str = "", force: bool = False) -> dict:
    if not worktree_path:
        return {"error": "worktree_path is required"}
    try:
        p = Path(path).expanduser()
        cwd = str(p if p.is_dir() else p.parent)
        args = ["worktree", "remove"]
        if force:
            args.append("--force")
        args.append(str(Path(worktree_path).expanduser()))
        result = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return {"success": True, "path": worktree_path}
        return {"error": result.stderr.strip() or "Failed to remove worktree", "exit_code": result.returncode}
    except Exception as e:
        return {"error": str(e)}

def worktree_prune(path: str = ".") -> dict:
    try:
        p = Path(path).expanduser()
        cwd = str(p if p.is_dir() else p.parent)
        result = subprocess.run(["git", "worktree", "prune"], cwd=cwd, capture_output=True, text=True, timeout=10)
        return {"success": result.returncode == 0, "stdout": result.stdout, "stderr": result.stderr}
    except Exception as e:
        return {"error": str(e)}

TOOLS = [
    {"name": "worktree_list", "description": "List all git worktrees for a repository", "handler": worktree_list, "params": {"path": "Repository path"}},
    {"name": "worktree_add", "description": "Create a new git worktree with a new branch", "handler": worktree_add, "params": {"path": "Repository path", "worktree_path": "Path for new worktree", "branch": "New branch name", "ref": "Base ref (commit/branch, optional)"}},
    {"name": "worktree_remove", "description": "Remove a git worktree", "handler": worktree_remove, "params": {"path": "Repository path", "worktree_path": "Worktree path to remove", "force": "Force removal (boolean)"}},
    {"name": "worktree_prune", "description": "Prune worktree administrative files", "handler": worktree_prune, "params": {"path": "Repository path"}},
]
