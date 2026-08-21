import subprocess
import os

TOOLS = [
    {
        "name": "git_status",
        "description": "Show the working tree status",
        "params": {"path": "Repository path (default: current directory)"},
        "handler": lambda path="." : _run_git(["status", "--porcelain"], path)
    },
    {
        "name": "git_diff",
        "description": "Show changes between commits, working tree, etc",
        "params": {"path": "Repository path", "target": "Target to diff against (default: working tree)"},
        "handler": lambda path=".", target="" : _run_git(["diff"] + ([target] if target else []), path)
    },
    {
        "name": "git_diff_staged",
        "description": "Show changes in the index (staged changes)",
        "params": {"path": "Repository path"},
        "handler": lambda path=".": _run_git(["diff", "--cached"], path)
    },
    {
        "name": "git_log",
        "description": "Show commit logs",
        "params": {"path": "Repository path", "count": "Number of commits to show (default: 10)"},
        "handler": lambda path=".", count="10": _run_git(["log", f"--oneline", f"-{count}"], path)
    },
    {
        "name": "git_commit",
        "description": "Create a new commit with staged changes",
        "params": {"path": "Repository path", "message": "Commit message"},
        "handler": lambda path=".", message="": _run_git(["commit", "-m", message], path) if message else {"error": "Commit message is required"}
    },
    {
        "name": "git_add",
        "description": "Stage files for commit",
        "params": {"path": "Repository path", "files": "Space-separated list of files to stage (or '.' for all)"},
        "handler": lambda path=".", files=".": _run_git(["add"] + files.split(), path)
    },
    {
        "name": "git_branch",
        "description": "List, create, or delete branches",
        "params": {"path": "Repository path", "name": "Branch name (to create/checkout)"},
        "handler": lambda path=".", name="": _run_git(["branch", name] if name else ["branch", "-a"], path)
    },
    {
        "name": "git_checkout",
        "description": "Switch to a branch or commit",
        "params": {"path": "Repository path", "target": "Branch or commit to checkout"},
        "handler": lambda path=".", target="": _run_git(["checkout", target], path) if target else {"error": "Target is required"}
    },
    {
        "name": "git_clone",
        "description": "Clone a repository",
        "params": {"url": "Repository URL", "dest": "Destination path (optional)"},
        "handler": lambda url="", dest="": _run_git(["clone", url, dest] if dest else ["clone", url], ".") if url else {"error": "URL is required"}
    },
    {
        "name": "git_push",
        "description": "Push commits to remote",
        "params": {"path": "Repository path", "remote": "Remote name (default: origin)", "branch": "Branch name"},
        "handler": lambda path=".", remote="origin", branch="": _run_git(["push", remote] + ([branch] if branch else []), path)
    },
    {
        "name": "git_pull",
        "description": "Pull changes from remote",
        "params": {"path": "Repository path", "remote": "Remote name (default: origin)"},
        "handler": lambda path=".", remote="origin": _run_git(["pull", remote], path)
    },
    {
        "name": "git_stash",
        "description": "Stash working tree changes",
        "params": {"path": "Repository path", "action": "stash/pop/drop/list"},
        "handler": lambda path=".", action="push": _run_git(["stash"] + (["pop"] if action == "pop" else ["drop"] if action == "drop" else ["list"] if action == "list" else []), path)
    },
    {
        "name": "git_blame",
        "description": "Show who changed each line of a file",
        "params": {"path": "Repository path", "file": "File to blame"},
        "handler": lambda path=".", file="": _run_git(["blame", file], path) if file else {"error": "File is required"}
    },
    {
        "name": "git_ignore",
        "description": "Add patterns to .gitignore",
        "params": {"path": "Repository path", "patterns": "Patterns to add (newline-separated)"},
        "handler": lambda path=".", patterns="": _add_gitignore(path, patterns)
    },
]


def _run_git(args: list, cwd: str) -> dict:
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"error": "Git command timed out after 30 seconds"}
    except FileNotFoundError:
        return {"error": "Git is not installed or not in PATH"}
    except Exception as e:
        return {"error": str(e)}


def _add_gitignore(path: str, patterns: str) -> dict:
    try:
        gitignore_path = os.path.join(path, ".gitignore")
        existing = ""
        if os.path.exists(gitignore_path):
            with open(gitignore_path, "r") as f:
                existing = f.read()
        
        new_patterns = [p.strip() for p in patterns.split("\n") if p.strip()]
        existing_lines = set(existing.strip().split("\n") if existing.strip() else [])
        
        added = []
        for pattern in new_patterns:
            if pattern not in existing_lines:
                added.append(pattern)
                existing_lines.add(pattern)
        
        with open(gitignore_path, "w") as f:
            f.write("\n".join(sorted(existing_lines)) + "\n")
        
        return {"success": True, "added": added, "total_patterns": len(existing_lines)}
    except Exception as e:
        return {"error": str(e)}
