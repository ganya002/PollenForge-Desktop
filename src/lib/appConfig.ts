import type { Config, ModelInfo, ProviderConfig } from '../store/store'
import { catalogEntry, emptyProviderConfig } from './providerCatalog.ts'

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

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

export function enabledProviderIds(config: Config): string[] {
  const listed = config.enabled_providers
  if (Array.isArray(listed) && listed.length > 0) return listed
  return ['pollinations']
}

/** Backend /config has provider keys but no models list. Keep the UI catalog. */
export function mergeFetchedConfig(current: Config, remote: unknown): Config {
  const data = asRecord(remote)
  if (!data) return current

  const next: Config = { ...current, enabled_providers: [...enabledProviderIds(current)] }

  if (typeof data.temperature === 'number') next.temperature = data.temperature
  if (typeof data.max_tokens === 'number') next.max_tokens = data.max_tokens
  if (typeof data.auto_approve === 'boolean') next.auto_approve = data.auto_approve
  if (typeof data.model === 'string') next.model = data.model
  if (typeof data.provider === 'string') next.provider = data.provider

  if (Array.isArray(data.installed_plugins)) {
    next.installed_plugins = uniqueIds(data.installed_plugins.filter((id): id is string => typeof id === 'string'))
  }
  if (Array.isArray(data.active_plugins)) {
    next.active_plugins = uniqueIds(data.active_plugins.filter((id): id is string => typeof id === 'string'))
  }
  const opts = asRecord(data.plugin_options)
  if (opts) {
    const plugin_options: Record<string, string> = {}
    for (const [k, v] of Object.entries(opts)) {
      if (typeof v === 'string') plugin_options[k] = v
    }
    next.plugin_options = plugin_options
  }

  const remoteEnabled = Array.isArray(data.enabled_providers)
    ? data.enabled_providers.filter((id): id is string => typeof id === 'string')
    : null

  const remoteProviders = asRecord(data.providers)
  const providers: Record<string, ProviderConfig> = { ...current.providers }
  const inferredEnabled: string[] = []

  if (remoteProviders) {
    for (const [name, incoming] of Object.entries(remoteProviders)) {
      const inc = asRecord(incoming) || {}
      const existing = providers[name]
      const catalog = emptyProviderConfig(name)
      const hasKey = typeof inc.api_key === 'string' && inc.api_key.length > 0
      const flaggedOn = inc.enabled === true
      if (flaggedOn || hasKey) inferredEnabled.push(name)

      const shouldKeep = existing || flaggedOn || hasKey || remoteEnabled?.includes(name)
      if (!shouldKeep) continue

      const models = asModels(inc.models) ?? existing?.models ?? catalog.models
      providers[name] = {
        api_key: hasKey ? (inc.api_key as string) : existing?.api_key || '',
        base_url: typeof inc.base_url === 'string' ? inc.base_url : existing?.base_url || catalog.base_url,
        models,
      }
    }
  }

  next.providers = providers
  if (remoteEnabled && remoteEnabled.length > 0) {
    next.enabled_providers = uniqueIds(remoteEnabled)
  } else if (inferredEnabled.length > 0) {
    next.enabled_providers = uniqueIds([...enabledProviderIds(current), ...inferredEnabled])
  }

  for (const id of next.enabled_providers) {
    if (!next.providers[id]) next.providers[id] = emptyProviderConfig(id)
  }
  return next
}

export function addEnabledProvider(config: Config, id: string): Config {
  if (!catalogEntry(id)) return config
  const enabled = uniqueIds([...enabledProviderIds(config), id])
  return {
    ...config,
    enabled_providers: enabled,
    providers: {
      ...config.providers,
      [id]: config.providers[id] || emptyProviderConfig(id),
    },
  }
}

export function removeEnabledProvider(config: Config, id: string): Config {
  if (id === 'pollinations') return config
  const enabled = enabledProviderIds(config).filter((name) => name !== id)
  const nextEnabled = enabled.length > 0 ? enabled : ['pollinations']
  const providers = { ...config.providers }
  delete providers[id]
  if (!providers.pollinations) providers.pollinations = emptyProviderConfig('pollinations')
  return { ...config, enabled_providers: nextEnabled, providers }
}

export function persistConfig(config: Config) {
  fetch('http://127.0.0.1:8765/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }).catch(() => {})
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
