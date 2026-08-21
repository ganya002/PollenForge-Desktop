from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator


class Provider(ABC):
    name: str = "base"
    models: list[dict] = []

    @abstractmethod
    async def chat_stream(self, messages: list[dict], model: str, params: dict) -> AsyncGenerator[str, None]:
        yield ""

    @abstractmethod
    async def list_models(self) -> list[dict]:
        return []

    @abstractmethod
    async def validate_key(self, api_key: str) -> bool:
        return False
