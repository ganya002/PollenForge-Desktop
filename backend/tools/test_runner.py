import subprocess
import os
from pathlib import Path

TOOLS = [
    {
        "name": "run_tests",
        "description": "Run tests for the project (auto-detects test framework)",
        "params": {"path": "Project root", "pattern": "File pattern to test (optional)", "framework": "Force framework (jest/pytest/vitest/go)"},
        "handler": lambda path=".", pattern="", framework="": _run_tests(path, pattern, framework)
    },
    {
        "name": "run_linter",
        "description": "Run linter on the project",
        "params": {"path": "Project root", "fix": "Auto-fix issues (default: false)"},
        "handler": lambda path=".", fix=False: _run_linter(path, fix)
    },
    {
        "name": "run_formatter",
        "description": "Run code formatter on the project",
        "params": {"path": "Project root", "check": "Check only, don't modify (default: false)"},
        "handler": lambda path=".", check=False: _run_formatter(path, check)
    },
    {
        "name": "run_build",
        "description": "Run project build",
        "params": {"path": "Project root", "script": "Build script name (default: build)"},
        "handler": lambda path=".", script="build": _run_build(path, script)
    },
    {
        "name": "run_typecheck",
        "description": "Run type checking on the project",
        "params": {"path": "Project root"},
        "handler": lambda path=".": _run_typecheck(path)
    },
    {
        "name": "run_security_scan",
        "description": "Run security/vulnerability scan on dependencies",
        "params": {"path": "Project root"},
        "handler": lambda path=".": _run_security_scan(path)
    },
    {
        "name": "run_dependency_audit",
        "description": "Audit dependencies for vulnerabilities",
        "params": {"path": "Project root"},
        "handler": lambda path=".": _run_dependency_audit(path)
    },
    {
        "name": "check_test_coverage",
        "description": "Check test coverage",
        "params": {"path": "Project root"},
        "handler": lambda path=".": _check_coverage(path)
    },
]


def _detect_framework(path: str) -> str:
    p = Path(path)
    if (p / "package.json").exists():
        pkg = (p / "package.json").read_text()
        if "vitest" in pkg:
            return "vitest"
        if "jest" in pkg:
            return "jest"
        if "mocha" in pkg:
            return "mocha"
    if (p / "pytest.ini").exists() or (p / "setup.cfg").exists() or (p / "pyproject.toml").exists():
        return "pytest"
    if (p / "Cargo.toml").exists():
        return "cargo"
    if (p / "go.mod").exists():
        return "go"
    if (p / "Makefile").exists():
        return "make"
    return "unknown"


def _sanitize_pattern(pattern: str) -> str:
    if not pattern:
        return ""
    # Block shell injection attempts
    if any(c in pattern for c in [';', '&', '|', '`', '$', '\n', '\r']):
        raise ValueError("Pattern contains invalid shell characters")
    # Only allow safe chars for test patterns
    if len(pattern) > 500:
        raise ValueError("Pattern too long")
    return pattern

def _run_tests(path: str, pattern: str, framework: str) -> dict:
    try:
        if pattern:
            pattern = _sanitize_pattern(pattern)
        if not framework:
            framework = _detect_framework(path)
        
        commands = {
            "jest": f"npx jest {pattern} --no-coverage" if pattern else "npx jest --no-coverage",
            "vitest": f"npx vitest run {pattern}" if pattern else "npx vitest run",
            "pytest": f"python -m pytest {pattern} -v" if pattern else "python -m pytest -v",
            "cargo": "cargo test",
            "go": "go test ./...",
            "make": "make test",
        }
        
        cmd = commands.get(framework)
        if not cmd:
            # Try npm test as fallback
            cmd = "npm test"
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        return {
            "stdout": result.stdout[-5000:] if len(result.stdout) > 5000 else result.stdout,
            "stderr": result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr,
            "exit_code": result.returncode,
            "framework": framework,
            "passed": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {"error": "Tests timed out after 5 minutes", "framework": framework}
    except Exception as e:
        return {"error": str(e), "framework": framework}


def _run_linter(path: str, fix: bool) -> dict:
    try:
        p = Path(path)
        
        if (p / "package.json").exists():
            pkg = (p / "package.json").read_text()
            if "eslint" in pkg:
                cmd = f"npx eslint {'--fix' if fix else ''} . --max-warnings=1000"
            elif "biome" in pkg:
                cmd = f"npx biome check {'--write' if fix else ''} ."
            else:
                return {"error": "No linter found in package.json"}
        elif any((p / f).exists() for f in [".flake8", "setup.cfg", "pyproject.toml"]):
            cmd = f"python -m flake8 ." if not fix else f"python -m autopep8 --in-place -r ."
        elif (p / "Cargo.toml").exists():
            cmd = "cargo clippy -- -D warnings"
        else:
            return {"error": "Could not detect linter for project"}
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        return {
            "stdout": result.stdout[-3000:],
            "stderr": result.stderr[-2000:],
            "exit_code": result.returncode,
            "fixed": fix and result.returncode == 0
        }
    except Exception as e:
        return {"error": str(e)}


def _run_formatter(path: str, check: bool) -> dict:
    try:
        p = Path(path)
        
        if (p / "package.json").exists():
            pkg = (p / "package.json").read_text()
            if "prettier" in pkg:
                cmd = f"npx prettier {'--check' if check else '--write'} ."
            elif "biome" in pkg:
                cmd = f"npx biome format {'--check' if check else '--write'} ."
            else:
                return {"error": "No formatter found"}
        elif any((p / f).exists() for f in ["pyproject.toml", ".flake8"]):
            cmd = f"python -m black {'--check' if check else ''} ."
        else:
            return {"error": "Could not detect formatter"}
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        return {
            "stdout": result.stdout[-3000:],
            "stderr": result.stderr[-2000:],
            "exit_code": result.returncode,
            "check_mode": check
        }
    except Exception as e:
        return {"error": str(e)}


def _run_build(path: str, script: str) -> dict:
    try:
        p = Path(path)
        
        if (p / "package.json").exists():
            pkg = (p / "package.json").read_text()
            import json
            scripts = json.loads(pkg).get("scripts", {})
            if script in scripts:
                cmd = f"npm run {script}"
            elif "build" in scripts:
                cmd = "npm run build"
            else:
                return {"error": f"No '{script}' script found in package.json"}
        elif (p / "Makefile").exists():
            cmd = f"make {script}"
        elif (p / "Cargo.toml").exists():
            cmd = "cargo build --release"
        elif (p / "go.mod").exists():
            cmd = "go build ./..."
        else:
            return {"error": "Could not detect build system"}
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=600
        )
        
        return {
            "stdout": result.stdout[-5000:],
            "stderr": result.stderr[-3000:],
            "exit_code": result.returncode,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {"error": "Build timed out after 10 minutes"}
    except Exception as e:
        return {"error": str(e)}


def _run_typecheck(path: str) -> dict:
    try:
        p = Path(path)
        
        if (p / "package.json").exists():
            pkg = (p / "package.json").read_text()
            if "typescript" in pkg:
                cmd = "npx tsc --noEmit"
            else:
                return {"error": "TypeScript not found in project"}
        elif (p / "Cargo.toml").exists():
            cmd = "cargo check"
        elif any((p / f).exists() for f in ["pyproject.toml", "mypy.ini"]):
            cmd = "python -m mypy ."
        else:
            return {"error": "Could not detect type checker"}
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        return {
            "stdout": result.stdout[-3000:],
            "stderr": result.stderr[-2000:],
            "exit_code": result.returncode,
            "passed": result.returncode == 0
        }
    except Exception as e:
        return {"error": str(e)}


def _run_security_scan(path: str) -> dict:
    try:
        p = Path(path)
        
        if (p / "package.json").exists():
            cmd = "npm audit 2>&1 || true"
        elif any((p / f).exists() for f in ["requirements.txt", "pyproject.toml"]):
            cmd = "pip-audit 2>/dev/null || safety check 2>/dev/null || echo 'Install pip-audit or safety for security scanning'"
        elif (p / "Cargo.toml").exists():
            cmd = "cargo audit 2>/dev/null || cargo install cargo-audit && cargo audit"
        else:
            return {"error": "Could not detect package manager for security scan"}
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        return {
            "stdout": result.stdout[-5000:],
            "stderr": result.stderr[-2000:],
            "exit_code": result.returncode
        }
    except Exception as e:
        return {"error": str(e)}


def _run_dependency_audit(path: str) -> dict:
    return _run_security_scan(path)


def _check_coverage(path: str) -> dict:
    try:
        p = Path(path)
        
        if (p / "package.json").exists():
            pkg = (p / "package.json").read_text()
            if "vitest" in pkg:
                cmd = "npx vitest run --coverage"
            elif "jest" in pkg:
                cmd = "npx jest --coverage"
            else:
                return {"error": "No test framework with coverage support found"}
        else:
            return {"error": "Coverage checking not supported for this project type"}
        
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=path,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        return {
            "stdout": result.stdout[-5000:],
            "stderr": result.stderr[-2000:],
            "exit_code": result.returncode
        }
    except Exception as e:
        return {"error": str(e)}
