import re

DANGEROUS_PATTERNS = [
    r'\brm\s+-rf\b',
    r'\brm\s+-r\b',
    r'\brmdir\b',
    r'\bmkfs\b',
    r'\bdd\b',
    r'\bformat\b',
    r'\bshutdown\b',
    r'\breboot\b',
    r'\bkill\b',
    r'\bpkill\b',
    r'\bsudo\b',
    r'\bsu\b',
    r'\bchmod\s+777\b',
    r'\bchown\b',
    r'\bcurl\b.*\|\s*sh\b',
    r'\bcurl\b.*\|\s*bash\b',
    r'\bwget\b.*\|\s*sh\b',
    r'\bwget\b.*\|\s*bash\b',
    r'\b>\s*/dev/sd\b',
    r'\b:\(\)\{.*\|.*\}\s*;',  # fork bomb
    r'\bvolatile-rename\b',
    r'\bfind\b.*-delete\b',
    r'\bfind\b.*-exec\s+rm\b',
    r'\bdrop\s+table\b',
    r'\bdrop\s+database\b',
    r'\bdelete\s+from\b',
    r'\bpermanent\b',
    r'\bdestroy\b',
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in DANGEROUS_PATTERNS]


def is_dangerous(cmd: str) -> bool:
    cmd_stripped = cmd.strip()
    for pattern in _COMPILED:
        if pattern.search(cmd_stripped):
            return True
    return False
