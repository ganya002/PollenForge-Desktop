import os
import shutil
from pathlib import Path

APP = "nexum"
LEGACY = "pollenforge"


def user_data_dir() -> Path:
    raw = os.environ.get("NEXUM_USER_DATA", "").strip()
    if raw:
        path = Path(raw)
    else:
        path = Path.home() / ".local" / "share" / APP
    path.mkdir(parents=True, exist_ok=True)
    return path


def config_dir() -> Path:
    path = user_data_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def config_file() -> Path:
    current = config_dir() / "config.json"
    if current.exists():
        return current
    for candidate in (
        Path.home() / ".config" / APP / "config.json",
        Path.home() / ".config" / LEGACY / "config.json",
    ):
        if candidate.exists():
            return candidate
    return current


def data_dir() -> Path:
    return user_data_dir()


def env_files() -> list[Path]:
    return [
        data_dir() / ".env",
        Path.home() / ".local" / "share" / APP / ".env",
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


def generated_images_dir() -> Path:
    path = data_dir() / "generated-images"
    path.mkdir(parents=True, exist_ok=True)
    return path


def legacy_skills_dir() -> Path:
    return Path.home() / ".local" / "share" / LEGACY / "skills"


def _copy_file_if_missing(src: Path, dest: Path) -> None:
    if not src.exists() or not src.is_file() or dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def _copy_dir_files_if_missing(src: Path, dest: Path) -> None:
    if not src.exists() or not src.is_dir():
        return
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.is_file():
            _copy_file_if_missing(item, dest / item.name)


def migrate_legacy_data() -> None:
    dest = user_data_dir()
    _copy_file_if_missing(Path.home() / ".config" / APP / "config.json", dest / "config.json")
    _copy_file_if_missing(Path.home() / ".config" / LEGACY / "config.json", dest / "config.json")
    old_share = Path.home() / ".local" / "share" / APP
    if old_share.resolve() != dest.resolve():
        _copy_file_if_missing(old_share / "config.json", dest / "config.json")
        _copy_file_if_missing(old_share / ".env", dest / ".env")
        _copy_dir_files_if_missing(old_share / "sessions", dest / "sessions")
        _copy_dir_files_if_missing(old_share / "skills", dest / "skills")
    _copy_file_if_missing(Path.home() / ".local" / "share" / LEGACY / ".env", dest / ".env")
    _copy_dir_files_if_missing(Path.home() / ".local" / "share" / LEGACY / "sessions", dest / "sessions")
    _copy_dir_files_if_missing(Path.home() / ".local" / "share" / LEGACY / "skills", dest / "skills")


migrate_legacy_data()
