import json
from app_paths import config_dir, config_file

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


def load_config() -> dict:
    config_dir().mkdir(parents=True, exist_ok=True)
    source = config_file()
    if source.exists():
        try:
            saved = json.loads(source.read_text())
            merged = {**DEFAULT_CONFIG}
            for k, v in saved.items():
                if isinstance(v, dict) and k in merged and isinstance(merged[k], dict):
                    merged[k] = {**merged[k], **v}
                else:
                    merged[k] = v
            return merged
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()


def save_config(cfg: dict):
    dest = config_dir() / "config.json"
    dest.write_text(json.dumps(cfg, indent=2))
