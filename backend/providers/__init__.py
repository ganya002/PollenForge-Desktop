from pathlib import Path
import importlib
import pkgutil

PROVIDER_MAP = {}


def _discover_providers():
    package_dir = Path(__file__).parent
    for _, name, _ in pkgutil.iter_modules([str(package_dir)]):
        if name.startswith("_") or name == "base":
            continue
        try:
            mod = importlib.import_module(f"providers.{name}")
            if hasattr(mod, "PROVIDER"):
                provider = mod.PROVIDER
                PROVIDER_MAP[provider.name] = provider
        except Exception:
            continue


def get_provider(name: str):
    if not PROVIDER_MAP:
        _discover_providers()
    return PROVIDER_MAP.get(name)


def list_providers() -> list[dict]:
    if not PROVIDER_MAP:
        _discover_providers()
    return [
        {
            "name": p.name,
            "models": p.models
        }
        for p in PROVIDER_MAP.values()
    ]
