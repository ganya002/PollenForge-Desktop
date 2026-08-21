def _as_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _is_free(model_id: str, pricing: dict | None) -> bool:
    if isinstance(model_id, str) and ":free" in model_id:
        return True
    if not pricing or not isinstance(pricing, dict):
        return True
    nums = []
    for key, value in pricing.items():
        if key == "currency":
            continue
        try:
            nums.append(float(value))
        except (TypeError, ValueError):
            continue
    return not nums or all(n == 0 for n in nums)


def _display_name(model_id: str) -> str:
    slug = model_id.split("/")[-1]
    if slug.endswith(":free"):
        slug = slug[:-5]
    return slug.replace("-", " ").replace("_", " ")


def map_pollinations_model(row: dict) -> dict:
    model_id = str(row.get("id") or "")
    pricing = row.get("pricing") if isinstance(row.get("pricing"), dict) else {}
    free = _is_free(model_id, pricing)
    ctx = row.get("context_length") or 128000
    try:
        ctx = int(ctx)
    except (TypeError, ValueError):
        ctx = 128000
    prompt = _as_float(pricing.get("promptTextTokens"))
    completion = _as_float(pricing.get("completionTextTokens"))
    return {
        "id": model_id,
        "name": _display_name(model_id),
        "cost_per_1k": 0.0 if free else (prompt + completion) * 1000,
        "cost_in_per_1k": 0.0 if free else prompt * 1000,
        "cost_out_per_1k": 0.0 if free else completion * 1000,
        "cost_currency": "pollen",
        "context_length": ctx,
        "free": free,
    }


def map_pollinations_models(payload) -> list[dict]:
    if isinstance(payload, dict):
        rows = payload.get("data") or payload.get("models") or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []
    out = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        endpoints = row.get("supported_endpoints") or []
        if endpoints and "/v1/chat/completions" not in endpoints:
            continue
        mapped = map_pollinations_model(row)
        if not mapped["id"] or mapped["id"] in seen:
            continue
        seen.add(mapped["id"])
        out.append(mapped)
    out.sort(key=lambda m: (1 if "/" in m["id"] else 0, m["name"].lower(), m["id"]))
    return out
