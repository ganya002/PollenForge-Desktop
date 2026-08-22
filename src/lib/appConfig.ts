import type { Config, ModelInfo, ProviderConfig } from '../store/store'
import { catalogEntry, emptyProviderConfig } from './providerCatalog.ts'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asModels(value: unknown): ModelInfo[] | undefined {
  if (!Array.isArray(value)) return undefined
  const models: ModelInfo[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const model = item as Record<string, unknown>
    if (typeof model.id !== 'string' || !model.id) continue
    models.push({
      id: model.id,
      name: typeof model.name === 'string' && model.name ? model.name : model.id,
      cost_per_1k: typeof model.cost_per_1k === 'number' ? model.cost_per_1k : 0,
      context_length: typeof model.context_length === 'number' ? model.context_length : 128000,
      ...(typeof model.free === 'boolean' ? { free: model.free } : {}),
      ...(typeof model.cost_in_per_1k === 'number' ? { cost_in_per_1k: model.cost_in_per_1k } : {}),
      ...(typeof model.cost_out_per_1k === 'number' ? { cost_out_per_1k: model.cost_out_per_1k } : {}),
      ...(typeof model.cost_currency === 'string' ? { cost_currency: model.cost_currency } : {}),
    })
  }
  return models.length ? models : undefined
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
  if (data.model_list === 'popular' || data.model_list === 'all' || data.model_list === 'free') {
    next.model_list = data.model_list
    next.free_models_only = data.model_list === 'free'
  } else if (typeof data.free_models_only === 'boolean') {
    next.free_models_only = data.free_models_only
    next.model_list = data.free_models_only ? 'free' : 'popular'
  }
  if (typeof data.model === 'string') next.model = data.model
  if (typeof data.provider === 'string') next.provider = data.provider
  if (typeof data.default_directory === 'string') next.default_directory = data.default_directory
  if (data.theme === 'dark' || data.theme === 'light' || data.theme === 'slate') next.theme = data.theme
  if (data.agent_mode === 'ask' || data.agent_mode === 'agent') next.agent_mode = data.agent_mode

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

      const models = existing?.models ?? catalog.models
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

export function mergeProviderModels(
  config: Config,
  providers: Array<{ name?: string; models?: unknown }>,
): Config {
  const nextProviders = { ...config.providers }
  let changed = false
  for (const row of providers) {
    const name = row?.name
    if (!name || !nextProviders[name]) continue
    const models = asModels(row.models)
    if (!models) continue
    nextProviders[name] = { ...nextProviders[name], models }
    changed = true
  }
  return changed ? { ...config, providers: nextProviders } : config
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
