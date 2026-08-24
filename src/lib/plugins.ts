import type { Config } from '../store/store'
import { PLUGIN_CATALOG, PLUGIN_CATALOG_MAP, pluginByCommand } from './pluginCatalog.ts'

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

const EXCLUSIVE: Record<string, string[]> = {
  goal: ['planner'],
  planner: ['goal', 'swarm'],
  swarm: ['planner'],
}

export function installedPluginIds(config: Config): string[] {
  return Array.isArray(config.installed_plugins) ? config.installed_plugins : []
}

export function activePluginIds(config: Config): string[] {
  const installed = new Set(installedPluginIds(config))
  let active = (config.active_plugins || []).filter((id) => installed.has(id))
  const lastExclusive = [...active].reverse().find((id) => id === 'goal' || id === 'planner')
  if (active.includes('goal') && active.includes('planner') && lastExclusive) {
    active = active.filter((id) => (id !== 'goal' && id !== 'planner') || id === lastExclusive)
  }
  return active
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
  if (on && !installedPluginIds(config).includes(id)) return config
  const drop = new Set(on ? EXCLUSIVE[id] || [] : [])
  const active = on
    ? unique([...(config.active_plugins || []).filter((p) => !drop.has(p)), id])
    : (config.active_plugins || []).filter((p) => p !== id)
  return { ...config, active_plugins: active }
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

  if (!installedPluginIds(config).includes(plugin.id)) {
    return {
      result: { kind: 'consumed', notice: `${plugin.name} is not installed. Install it from Settings → Plugins.` },
      config,
    }
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

export function installedPluginCommands(config: Config): Array<{ name: string; description: string }> {
  const installed = new Set(installedPluginIds(config))
  return PLUGIN_CATALOG.filter((p) => installed.has(p.id)).map((p) => ({
    name: p.command,
    description: p.description,
  }))
}
