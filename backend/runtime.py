from contextvars import ContextVar

runtime_var: ContextVar[dict | None] = ContextVar("nexum_runtime", default=None)
