import os
import re
from pathlib import Path

TOOLS = [
    {
        "name": "find_files",
        "description": "Find files matching a pattern",
        "params": {"path": "Directory to search", "pattern": "Glob pattern (e.g. '*.py', '**/*.ts')", "max": "Max results (default: 50)"},
        "handler": lambda path=".", pattern="*", max=50: _find_files(path, pattern, max)
    },
    {
        "name": "search_code",
        "description": "Search file contents for a pattern (regex supported)",
        "params": {"path": "Directory to search", "pattern": "Search pattern (regex)", "include": "File pattern to include (e.g. '*.py')", "max": "Max results (default: 30)"},
        "handler": lambda path=".", pattern="", include="*", max=30: _search_code(path, pattern, include, max)
    },
    {
        "name": "analyze_dependencies",
        "description": "Analyze project dependencies from package files",
        "params": {"path": "Project root path"},
        "handler": lambda path=".": _analyze_dependencies(path)
    },
    {
        "name": "count_lines",
        "description": "Count lines of code in files",
        "params": {"path": "Directory to analyze", "include": "File pattern (e.g. '*.py')"},
        "handler": lambda path=".", include="*": _count_lines(path, include)
    },
    {
        "name": "find_functions",
        "description": "Find function/class definitions in code",
        "params": {"path": "Directory to search", "include": "File pattern", "pattern": "Name pattern to search for"},
        "handler": lambda path=".", include="*", pattern="": _find_definitions(path, include, pattern)
    },
    {
        "name": "get_file_info",
        "description": "Get detailed info about a file (size, type, lines, etc)",
        "params": {"path": "File path"},
        "handler": lambda path="": _get_file_info(path)
    },
    {
        "name": "tree_view",
        "description": "Show directory tree structure",
        "params": {"path": "Directory path", "depth": "Max depth (default: 3)", "ignore": "Patterns to ignore (comma-separated)"},
        "handler": lambda path=".", depth=3, ignore="": _tree_view(path, int(depth), ignore)
    },
]


IGNORED_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".next", "dist", "build", ".DS_Store", ".turbo", "coverage", ".mypy_cache", ".pytest_cache"}

def _should_skip(p: Path) -> bool:
    return any(part in IGNORED_DIRS for part in p.parts)

def _guard_large_scope(path: str, pattern: str) -> str | None:
    # Prevent scanning entire home with huge regex
    p = Path(path).expanduser().resolve()
    home = Path.home().resolve()
    if p == home and len(pattern) > 30:
        return "Refusing to search entire home with large pattern (>30 chars). Use narrower path like /Users/gabbo/project"
    if str(p).startswith(str(home)) and p != home:
        # Allow but warn
        pass
    return None

def _find_files(path: str, pattern: str, max_results: int) -> dict:
    try:
        if max_results:
            max_results = max(1, min(int(max_results), 200))
        p = Path(path).expanduser()
        if not p.exists():
            return {"error": f"Path not found: {path}"}
        if "\x00" in pattern:
            return {"error": "Invalid pattern"}
        guard = _guard_large_scope(path, pattern)
        if guard:
            return {"error": guard}
        matches = []
        try:
            iterator = p.rglob(pattern)
        except Exception as e:
            return {"error": f"Invalid pattern: {e}"}
        for item in iterator:
            if len(matches) >= max_results:
                break
            try:
                if item.is_file() and not item.is_symlink():
                    matches.append({
                        "path": str(item),
                        "name": item.name,
                        "size": item.stat().st_size,
                        "extension": item.suffix
                    })
            except:
                continue
        return {"files": matches, "count": len(matches), "truncated": len(matches) >= max_results}
    except Exception as e:
        return {"error": str(e)}


def _search_code(path: str, pattern: str, include: str, max_results: int) -> dict:
    if not pattern:
        return {"error": "Search pattern is required"}
    if len(pattern) > 200:
        return {"error": "Pattern too long (max 200 chars)"}
    guard = _guard_large_scope(path, pattern)
    if guard:
        return {"error": guard}
    try:
        p = Path(path).expanduser()
        if not p.exists():
            return {"error": f"Path not found: {path}"}
        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error as e:
            return {"error": f"Invalid regex: {e}"}
        matches = []
        scanned = 0
        max_scanned = 2000
        for file in p.rglob(include):
            if _should_skip(file):
                continue
            if len(matches) >= max_results:
                break
            if scanned >= max_scanned:
                return {"matches": matches, "count": len(matches), "pattern": pattern, "truncated": True, "scanned": scanned, "note": f"Scanned {scanned} files, stopping early"}
            scanned += 1
            if file.is_file() and not file.is_symlink():
                try:
                    if file.stat().st_size >= 1_000_000:
                        continue
                    content = file.read_text(errors="ignore")
                    for i, line in enumerate(content.split("\n"), 1):
                        if regex.search(line):
                            matches.append({
                                "file": str(file),
                                "line": i,
                                "content": line.strip()[:200],
                                "match": pattern
                            })
                            if len(matches) >= max_results:
                                break
                except Exception:
                    continue
        return {"matches": matches, "count": len(matches), "pattern": pattern, "truncated": len(matches) >= max_results, "scanned": scanned}
    except re.error as e:
        return {"error": f"Invalid regex: {e}"}
    except Exception as e:
        return {"error": str(e)}


def _analyze_dependencies(path: str) -> dict:
    try:
        p = Path(path)
        deps = {}
        
        # Node.js
        pkg_json = p / "package.json"
        if pkg_json.exists():
            import json
            data = json.loads(pkg_json.read_text())
            deps["node"] = {
                "dependencies": list(data.get("dependencies", {}).keys()),
                "devDependencies": list(data.get("devDependencies", {}).keys()),
                "scripts": list(data.get("scripts", {}).keys())
            }
        
        # Python
        for req_file in ["requirements.txt", "setup.py", "pyproject.toml"]:
            req_path = p / req_file
            if req_path.exists():
                content = req_path.read_text()
                pkgs = [line.split("==")[0].split(">=")[0].split("<=")[0].strip() 
                       for line in content.split("\n") 
                       if line.strip() and not line.startswith("#")]
                deps["python"] = {"packages": pkgs, "file": req_file}
                break
        
        # Rust
        cargo = p / "Cargo.toml"
        if cargo.exists():
            content = cargo.read_text()
            pkgs = re.findall(r'name\s*=\s*"([^"]+)"', content)
            deps["rust"] = {"packages": pkgs}
        
        # Go
        go_mod = p / "go.mod"
        if go_mod.exists():
            content = go_mod.read_text()
            modules = re.findall(r'^\s*([\w./-]+)\s+v', content, re.MULTILINE)
            deps["go"] = {"modules": modules}
        
        return {"dependencies": deps, "path": str(p)}
    except Exception as e:
        return {"error": str(e)}


def _count_lines(path: str, include: str) -> dict:
    try:
        p = Path(path)
        if not p.exists():
            return {"error": f"Path not found: {path}"}
        
        total = 0
        by_extension = {}
        
        for file in p.rglob(include):
            if file.is_file() and file.stat().st_size < 1_000_000:
                try:
                    lines = len(file.read_text(errors="ignore").split("\n"))
                    total += lines
                    ext = file.suffix or "(no ext)"
                    by_extension[ext] = by_extension.get(ext, 0) + lines
                except Exception:
                    continue
        
        sorted_exts = sorted(by_extension.items(), key=lambda x: -x[1])
        return {"total_lines": total, "by_extension": dict(sorted_exts[:20]), "path": str(p)}
    except Exception as e:
        return {"error": str(e)}


def _find_definitions(path: str, include: str, pattern: str) -> dict:
    try:
        p = Path(path)
        if not p.exists():
            return {"error": f"Path not found: {path}"}
        
        definitions = []
        for file in p.rglob(include):
            if file.is_file() and file.stat().st_size < 500_000:
                try:
                    content = file.read_text(errors="ignore")
                    for i, line in enumerate(content.split("\n"), 1):
                        stripped = line.strip()
                        # Python
                        if stripped.startswith("def ") or stripped.startswith("class "):
                            name = stripped.split("(")[0].split(":")[0].replace("def ", "").replace("class ", "")
                            if not pattern or pattern.lower() in name.lower():
                                definitions.append({"type": "function" if "def" in stripped else "class", "name": name, "file": str(file), "line": i})
                        # JS/TS
                        elif re.match(r'(export\s+)?(async\s+)?function\s+(\w+)', stripped):
                            name = re.match(r'(export\s+)?(async\s+)?function\s+(\w+)', stripped).group(3)
                            if not pattern or pattern.lower() in name.lower():
                                definitions.append({"type": "function", "name": name, "file": str(file), "line": i})
                        # Types/interfaces
                        elif re.match(r'(export\s+)?(type|interface)\s+(\w+)', stripped):
                            name = re.match(r'(export\s+)?(type|interface)\s+(\w+)', stripped).group(3)
                            if not pattern or pattern.lower() in name.lower():
                                definitions.append({"type": "type", "name": name, "file": str(file), "line": i})
                except Exception:
                    continue
        
        return {"definitions": definitions[:50], "count": len(definitions)}
    except Exception as e:
        return {"error": str(e)}


def _get_file_info(path: str) -> dict:
    try:
        p = Path(path)
        if not p.exists():
            return {"error": f"File not found: {path}"}
        
        stat = p.stat()
        info = {
            "path": str(p.absolute()),
            "name": p.name,
            "extension": p.suffix,
            "size_bytes": stat.st_size,
            "size_human": _human_size(stat.st_size),
            "modified": stat.st_mtime,
            "is_file": p.is_file(),
            "is_dir": p.is_dir(),
        }
        
        if p.is_file() and stat.st_size < 1_000_000:
            try:
                content = p.read_text(errors="ignore")
                lines = content.split("\n")
                info["lines"] = len(lines)
                info["words"] = sum(len(line.split()) for line in lines)
                info["characters"] = len(content)
            except Exception:
                pass
        
        return info
    except Exception as e:
        return {"error": str(e)}


def _tree_view(path: str, depth: int, ignore_str: str) -> dict:
    try:
        p = Path(path)
        if not p.exists():
            return {"error": f"Path not found: {path}"}
        
        ignore_patterns = set(ignore_str.split(",")) if ignore_str else set()
        ignore_patterns.update({".git", "node_modules", "__pycache__", ".venv", "venv", ".DS_Store"})
        
        tree = []
        
        def _walk(dir_path: Path, current_depth: int, prefix: str = ""):
            if current_depth > depth:
                return
            try:
                items = sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
                for i, item in enumerate(items):
                    if item.name in ignore_patterns or any(item.name.endswith(p.replace("*", "")) for p in ignore_patterns if p.startswith("*")):
                        continue
                    is_last = i == len(items) - 1
                    connector = "└── " if is_last else "├── "
                    tree.append(f"{prefix}{connector}{item.name}{'/' if item.is_dir() else ''}")
                    if item.is_dir():
                        extension = "    " if is_last else "│   "
                        _walk(item, current_depth + 1, prefix + extension)
            except PermissionError:
                tree.append(f"{prefix}[Permission Denied]")
        
        tree.append(p.name + "/")
        _walk(p, 1)
        
        return {"tree": "\n".join(tree), "path": str(p)}
    except Exception as e:
        return {"error": str(e)}


def _human_size(size: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"
