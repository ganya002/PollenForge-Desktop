import json
import os

from app_paths import config_dir, config_file, env_files

CONFIG_DIR = config_dir()
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_CONFIG = {
    "default_provider": "pollinations",
    "default_model": "gpt-4o",
    "providers": {
        "pollinations": {
            "enabled": True,
            "api_key": None,
            "default_model": "gpt-4o"
        },
        "openai": {
            "enabled": False,
            "api_key": None,
            "default_model": "gpt-4o"
        },
        "anthropic": {
            "enabled": False,
            "api_key": None,
            "default_model": "claude-sonnet-4-20250514"
        },
        "google": {
            "enabled": False,
            "api_key": None,
            "default_model": "gemini-1.5-pro"
        },
        "ollama": {
            "enabled": False,
            "base_url": "http://localhost:11434",
            "default_model": "llama3"
        },
        "openrouter": {
            "enabled": False,
            "api_key": None,
            "base_url": "https://openrouter.ai/api/v1",
            "default_model": "anthropic/claude-3.5-sonnet"
        },
        "groq": {"enabled": False, "api_key": None, "base_url": "https://api.groq.com/openai/v1"},
        "deepseek": {"enabled": False, "api_key": None, "base_url": "https://api.deepseek.com"},
        "xai": {"enabled": False, "api_key": None, "base_url": "https://api.x.ai/v1"},
        "mistral": {"enabled": False, "api_key": None, "base_url": "https://api.mistral.ai/v1"},
        "together": {"enabled": False, "api_key": None, "base_url": "https://api.together.xyz/v1"},
        "fireworks": {"enabled": False, "api_key": None, "base_url": "https://api.fireworks.ai/inference/v1"},
        "cerebras": {"enabled": False, "api_key": None, "base_url": "https://api.cerebras.ai/v1"},
        "moonshot": {"enabled": False, "api_key": None, "base_url": "https://api.moonshot.ai/v1"},
    },
    "tools": {
        "filesystem": {"enabled": True, "base_dir": None},
        "shell": {"enabled": True, "timeout": 30, "dangerous_enabled": False},
        "apps": {"enabled": True}
    },
    "theme": "dark",
    "agent_mode": "agent",
    "font_size": 14,
    "max_tokens": 4096,
    "temperature": 0.7
}


def _merge_dicts(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        if isinstance(out.get(key), dict) and isinstance(value, dict):
            out[key] = _merge_dicts(out[key], value)
        else:
            out[key] = value
    return out


def _strip_api_key(value) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().strip('"').strip("'")


def resolve_provider_api_key(provider: str, cfg: dict | None = None) -> str:
    data = cfg if isinstance(cfg, dict) else load_config()
    key = _strip_api_key(((data.get("providers") or {}).get(provider) or {}).get("api_key"))
    if key:
        return key
    if provider != "pollinations":
        return ""
    env_key = _strip_api_key(os.environ.get("POLLINATIONS_API_KEY", ""))
    if env_key:
        return env_key
    for env_path in env_files():
        try:
            if not env_path.exists():
                continue
            for line in env_path.read_text().splitlines():
                if line.startswith("POLLINATIONS_API_KEY="):
                    found = _strip_api_key(line.split("=", 1)[1])
                    if found:
                        return found
        except Exception:
            continue
    return ""


def load_config() -> dict:
    config_dir().mkdir(parents=True, exist_ok=True)
    source = config_file()
    if source.exists():
        try:
            saved = json.loads(source.read_text())
            if isinstance(saved, dict):
                return _merge_dicts(DEFAULT_CONFIG, saved)
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()


def save_config(cfg: dict):
    dest = config_dir() / "config.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(f".{dest.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(cfg, indent=2))
    try:
        tmp.chmod(0o600)
    except Exception:
        pass
    tmp.replace(dest)
    try:
        dest.chmod(0o600)
    except Exception:
        pass
