import re
import shlex

# T8: narrow hard-block list — ambiguous goes to approval, not block
_FORK_BOMB_RE = re.compile(r":\(\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;\s*:")
_REDIRECT_RAW_RE = re.compile(r">\s*/dev/(?:sd\w*|disk\w*|nvme\w*|hd\w*)")
_DD_OF_RE = re.compile(r"of\s*=\s*/dev/")

# For python -c rmtree heuristic
_RMTREE_RE = re.compile(r"rmtree|shutil\.rmtree|os\.remove|os\.rmdir", re.I)


def _parse(cmd: str) -> list[str]:
    try:
        return shlex.split(cmd, posix=True)
    except ValueError:
        # Unparseable → treat as needs approval, not hard block
        return []


def _rm_flags(argv: list[str]) -> set[str]:
    flags: set[str] = set()
    for arg in argv[1:]:
        if arg.startswith("-") and not arg.startswith("--"):
            # -rf, -fr, -r -f  → collect single letters
            for ch in arg[1:]:
                if ch.isalpha():
                    flags.add(ch)
        elif arg.startswith("--"):
            flags.add(arg[2:])
    return flags


def _is_rm_dangerous(argv: list[str]) -> bool:
    if not argv or argv[0] not in ("rm", "rmdir"):
        return False
    flags = _rm_flags(argv)
    has_r = "r" in flags or "R" in flags or "recursive" in flags
    has_f = "f" in flags or "force" in flags
    # Only hard-block rm when recursive+force targeting root-like
    if argv[0] == "rm" and has_r and has_f:
        # Look at non-flag args
        targets = [a for a in argv[1:] if not a.startswith("-")]
        for t in targets:
            # Normalize
            t = t.strip().strip("'\"")
            if t in ("/", "/*", "/.", "~", "~/", "/*", "*", ".", "..") or t.startswith("/ ") or t.startswith("/*"):
                return True
            if t in ("/", "/.", "/*") or t.startswith("/") and t.count("/") >= 2 and len(t) < 6:
                # e.g., "/" or "/usr"
                if t == "/" or t.startswith("/ "):
                    return True
            # Heuristic: if target is "/" or "~" or absolute root
            if t == "/" or t == "~" or t.startswith("/ ") or t == "/*":
                return True
        # Don't block rm -rf node_modules etc.
        return False
    # rmdir without extra checks is not hard-blocked
    return False


def is_dangerous(cmd: str) -> bool:
    """
    Return True only for commands that should be HARD-BLOCKED even before approval.
    Everything ambiguous returns False and will be gated via DANGEROUS_TOOLS approval.
    """
    if not cmd or not cmd.strip():
        return False
    stripped = cmd.strip()

    # Fork bomb — always block
    if _FORK_BOMB_RE.search(stripped):
        return True
    # Redirect to raw disk
    if _REDIRECT_RAW_RE.search(stripped):
        return True

    argv = _parse(stripped)
    if not argv:
        return False
    prog = argv[0].split("/")[-1].lower()

    # Deny list — anchored to actual binary, not substring
    if prog in ("mkfs", "mkfs.ext4", "mkfs.btrfs", "mkfs.xfs"):
        return True
    if prog == "dd":
        # dd with of=/dev/*
        joined = " ".join(argv)
        if _DD_OF_RE.search(joined):
            return True
    if prog in ("shutdown", "reboot", "halt", "poweroff", "init"):
        return True
    # python -c with rmtree — hard block (heuristic for destructive)
    if prog in ("python", "python3", "python3.12", "python3.11") and "-c" in argv:
        joined = " ".join(argv)
        if _RMTREE_RE.search(joined) and "/" in joined:
            return True

    if _is_rm_dangerous(argv):
        return True

    # curl|sh etc. is not hard-blocked — gated via approval (server.py)
    # sudo, kill, format, permanent etc. are NOT blocked — false positives removed

    return False


def needs_approval(cmd: str) -> bool:
    """Helper for future capability gating: true if command is ambiguous/destructive."""
    if is_dangerous(cmd):
        return True
    argv = _parse(cmd)
    if not argv:
        return False
    prog = argv[0].split("/")[-1].lower()
    # Ambiguous that should still require approval (server.py already does via DANGEROUS_TOOLS,
    # but this helps if T3 wants finer granularity)
    if prog in ("rm", "rmdir", "chmod", "chown"):
        return True
    if "rmtree" in cmd or "shutil.rmtree" in cmd:
        return True
    if re.search(r"curl\s+.*\|\s*(?:sh|bash)", cmd):
        return True
    if re.search(r"wget\s+.*\|\s*(?:sh|bash)", cmd):
        return True
    return False
