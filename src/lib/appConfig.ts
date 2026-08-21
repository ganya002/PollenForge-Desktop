import type { Config, ModelInfo, ProviderConfig } from '../store/store'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asModels(value: unknown): ModelInfo[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is ModelInfo => {
    if (!item || typeof item !== 'object') return false
    const model = item as Record<string, unknown>
    return typeof model.id === 'string'
  })
}

/** Backend /config has provider keys but no models list. Keep the UI catalog. */
export function mergeFetchedConfig(current: Config, remote: unknown): Config {
  const data = asRecord(remote)
  if (!data) return current

  const next: Config = { ...current }

  if (typeof data.temperature === 'number') next.temperature = data.temperature
  if (typeof data.max_tokens === 'number') next.max_tokens = data.max_tokens
  if (typeof data.auto_approve === 'boolean') next.auto_approve = data.auto_approve
  if (typeof data.model === 'string') next.model = data.model
  if (typeof data.provider === 'string') next.provider = data.provider

  const remoteProviders = asRecord(data.providers)
  if (!remoteProviders) return next

  const providers: Record<string, ProviderConfig> = { ...current.providers }
  for (const [name, incoming] of Object.entries(remoteProviders)) {
    const inc = asRecord(incoming) || {}
    const existing = providers[name]
    const models = asModels(inc.models) ?? existing?.models ?? []
    providers[name] = {
      api_key: typeof inc.api_key === 'string' ? inc.api_key : existing?.api_key || '',
      base_url: typeof inc.base_url === 'string' ? inc.base_url : existing?.base_url,
      models,
    }
  }
  next.providers = providers
  return next
}

export function findProviderModel(
  config: Config,
  provider: string,
  modelId: string,
): ModelInfo | undefined {
  const models = config.providers?.[provider]?.models
  if (!Array.isArray(models)) return undefined
  return models.find((m) => m.id === modelId)
}
