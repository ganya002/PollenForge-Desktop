def _as_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _is_text_chat(row: dict) -> bool:
    arch = row.get("architecture") if isinstance(row.get("architecture"), dict) else {}
    outputs = arch.get("output_modalities") or []
    if isinstance(outputs, list) and outputs:
        texts = {str(x).lower() for x in outputs}
        if "text" not in texts:
            return False
        if texts <= {"embeddings", "embedding", "image", "audio"}:
            return False
    modality = str(arch.get("modality") or "").lower()
    if "embedding" in modality:
        return False
    model_id = str(row.get("id") or "").lower()
    if "embedding" in model_id:
        return False
    return True


def _is_free(model_id: str, pricing: dict | None) -> bool:
    if isinstance(model_id, str) and ":free" in model_id:
        return True
    if not pricing or not isinstance(pricing, dict):
        return False
    prompt = _as_float(pricing.get("prompt"))
    completion = _as_float(pricing.get("completion"))
    return prompt == 0 and completion == 0


def map_openrouter_model(row: dict) -> dict | None:
    if not isinstance(row, dict):
        return None
    if not _is_text_chat(row):
        return None
    model_id = str(row.get("id") or "").strip()
    if not model_id or model_id.startswith("~"):
        return None
    if ":batch" in model_id:
        return None
    pricing = row.get("pricing") if isinstance(row.get("pricing"), dict) else {}
    free = _is_free(model_id, pricing)
    ctx = row.get("context_length") or 128000
    try:
        ctx = int(ctx)
    except (TypeError, ValueError):
        ctx = 128000
    prompt = _as_float(pricing.get("prompt"))
    completion = _as_float(pricing.get("completion"))
    name = str(row.get("name") or model_id).strip() or model_id
    return {
        "id": model_id,
        "name": name,
        "cost_per_1k": 0.0 if free else (prompt + completion) * 1000,
        "cost_in_per_1k": 0.0 if free else prompt * 1000,
        "cost_out_per_1k": 0.0 if free else completion * 1000,
        "cost_currency": "usd",
        "context_length": ctx,
        "free": free,
    }


def map_openrouter_models(payload) -> list[dict]:
    if isinstance(payload, dict):
        rows = payload.get("data") or payload.get("models") or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []
    out = []
    seen = set()
    for row in rows:
        mapped = map_openrouter_model(row)
        if not mapped or mapped["id"] in seen:
            continue
        seen.add(mapped["id"])
        out.append(mapped)
    out.sort(key=lambda m: (m["name"].lower(), m["id"]))
    return out
