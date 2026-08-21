from pathlib import Path

APP = "nexum"
LEGACY = "pollenforge"


def config_dir() -> Path:
    path = Path.home() / ".config" / APP
    path.mkdir(parents=True, exist_ok=True)
    return path


def config_file() -> Path:
    current = config_dir() / "config.json"
    if current.exists():
        return current
    legacy = Path.home() / ".config" / LEGACY / "config.json"
    if legacy.exists():
        return legacy
    return current


def data_dir() -> Path:
    path = Path.home() / ".local" / "share" / APP
    path.mkdir(parents=True, exist_ok=True)
    return path


def env_files() -> list[Path]:
    return [
        data_dir() / ".env",
        Path.home() / ".local" / "share" / LEGACY / ".env",
    ]


def sessions_dir() -> Path:
    path = data_dir() / "sessions"
    path.mkdir(parents=True, exist_ok=True)
    return path


def legacy_sessions_dir() -> Path:
    return Path.home() / ".local" / "share" / LEGACY / "sessions"


def skills_dir() -> Path:
    path = data_dir() / "skills"
    path.mkdir(parents=True, exist_ok=True)
    return path


def legacy_skills_dir() -> Path:
    return Path.home() / ".local" / "share" / LEGACY / "skills"
