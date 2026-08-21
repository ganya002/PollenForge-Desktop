import type { Config } from '../store/store'
import { PLUGIN_CATALOG, PLUGIN_CATALOG_MAP, pluginByCommand } from './pluginCatalog.ts'

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

export function installedPluginIds(config: Config): string[] {
  return Array.isArray(config.installed_plugins) ? config.installed_plugins : []
}

export function activePluginIds(config: Config): string[] {
  const installed = new Set(installedPluginIds(config))
  return (config.active_plugins || []).filter((id) => installed.has(id))
}

export function installPlugin(config: Config, id: string): Config {
  if (!PLUGIN_CATALOG_MAP[id]) return config
  return { ...config, installed_plugins: unique([...installedPluginIds(config), id]) }
}

export function uninstallPlugin(config: Config, id: string): Config {
  return {
    ...config,
    installed_plugins: installedPluginIds(config).filter((p) => p !== id),
    active_plugins: (config.active_plugins || []).filter((p) => p !== id),
  }
}

export function setPluginActive(config: Config, id: string, on: boolean): Config {
  if (!PLUGIN_CATALOG_MAP[id]) return config
  const installed = unique([...installedPluginIds(config), id])
  const active = on
    ? unique([...activePluginIds({ ...config, installed_plugins: installed }), id])
    : (config.active_plugins || []).filter((p) => p !== id)
  return { ...config, installed_plugins: installed, active_plugins: active }
}

export function applyActivePlugins(userText: string, config: Config): string {
  const active = activePluginIds(config)
  if (active.length === 0) return userText
  const blocks = active
    .map((id) => {
      const entry = PLUGIN_CATALOG_MAP[id]
      if (!entry) return ''
      if (id === 'caveman' && config.plugin_options?.caveman_level) {
        return `${entry.prompt}\n\nRequested intensity: ${config.plugin_options.caveman_level}.`
      }
      return entry.prompt
    })
    .filter(Boolean)
  if (blocks.length === 0) return userText
  return `${blocks.join('\n\n')}\n\n---\nUser request:\n${userText}`
}

export type SlashResult =
  | { kind: 'ignore' }
  | { kind: 'consumed'; notice: string }
  | { kind: 'send'; text: string }

export function handlePluginSlash(raw: string, config: Config): { result: SlashResult; config: Config } {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return { result: { kind: 'ignore' }, config }

  const [cmd, ...rest] = trimmed.split(/\s+/)
  const args = rest.join(' ').trim()
  const plugin = pluginByCommand(cmd)
  if (!plugin) return { result: { kind: 'ignore' }, config }

  const off = /^(off|stop|normal)$/i.test(args)
  if (off) {
    const next = setPluginActive(config, plugin.id, false)
    return { result: { kind: 'consumed', notice: `${plugin.name} off` }, config: next }
  }

  let next = setPluginActive(config, plugin.id, true)
  if (plugin.id === 'caveman' && args && !off) {
    next = {
      ...next,
      plugin_options: { ...(next.plugin_options || {}), caveman_level: args.split(/\s+/)[0] },
    }
  }

  if (args && !off && plugin.id !== 'caveman') {
    return { result: { kind: 'send', text: args }, config: next }
  }
  if (plugin.id === 'caveman' && args && !/^(lite|full|ultra|wenyan[-\w]*)$/i.test(args.split(/\s+/)[0])) {
    return { result: { kind: 'send', text: args }, config: next }
  }

  const extra = plugin.id === 'caveman' && args ? ` (${args})` : ''
  return { result: { kind: 'consumed', notice: `${plugin.name} on${extra}. Next prompt uses it.` }, config: next }
}

export function marketplaceSearch(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return PLUGIN_CATALOG
  return PLUGIN_CATALOG.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.command.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  )
}
