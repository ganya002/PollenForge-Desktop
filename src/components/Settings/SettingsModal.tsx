import { apiFetch } from '../../lib/api'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/store'
import UpdatesPanel from './UpdatesPanel'
import MemoryPanel from './MemoryPanel'
import { PROVIDER_CATALOG } from '../../lib/providerCatalog'
import {
  addEnabledProvider,
  enabledProviderIds,
  persistConfig,
  removeEnabledProvider,
} from '../../lib/appConfig'
import { marketplaceSearch, installPlugin, uninstallPlugin, installedPluginIds } from '../../lib/plugins'
import { isFreeModel, resolveModelList, type ModelListMode } from '../../lib/modelFilter'
import { applyTheme, THEME_IDS, type ThemeId } from '../../lib/qol'

export type SettingsTab = 'providers' | 'plugins' | 'general' | 'memory' | 'updates' | 'about'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export default function SettingsModal({ open, onClose, initialTab = 'providers' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const config = useStore((s) => s.config)
  const setConfig = useStore((s) => s.setConfig)
  const setModel = useStore((s) => s.setModel)
  const currentProvider = useStore((s) => s.currentProvider)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [appVersion, setAppVersion] = useState('…')
  const [providerSearch, setProviderSearch] = useState('')
  const [pluginSearch, setPluginSearch] = useState('')
  const [pollinationsStatus, setPollinationsStatus] = useState<{ connected?: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setActiveTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    const current = useStore.getState().config
    const initial: Record<string, string> = {}
    for (const [name, cfg] of Object.entries(current.providers)) {
      initial[name] = cfg.api_key || ''
    }
    setKeys(initial)
    setSaved(false)
    setSaveError('')
    setPollinationsStatus(null)
    setProviderSearch('')
    setPluginSearch('')
    window.api?.app?.getVersion?.()
      .then((info) => setAppVersion(info.version))
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    setKeys((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [name, cfg] of Object.entries(config.providers)) {
        if (!next[name] && cfg.api_key) {
          next[name] = cfg.api_key
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [open, config])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    apiFetch('http://127.0.0.1:8765/pollinations/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setPollinationsStatus(data)
      })
      .catch(() => {
        if (!cancelled) setPollinationsStatus({ connected: false, error: 'Backend offline' })
      })
    return () => {
      cancelled = true
    }
  }, [open, saved, config.providers.pollinations?.api_key])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleSave = async () => {
    const updatedProviders = { ...config.providers }
    for (const [name, key] of Object.entries(keys)) {
      if (updatedProviders[name]) {
        updatedProviders[name] = { ...updatedProviders[name], api_key: key.trim() }
      }
    }
    const next = { ...config, providers: updatedProviders }
    setConfig(next)
    const ok = await persistConfig(next)
    if (!ok) {
      setSaveError('Could not write settings to disk.')
      setSaved(false)
      return
    }
    setSaveError('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="relative flex flex-col w-[min(40rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-2rem))] bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
              <h2 className="text-[15px] font-semibold text-text-primary">Settings</h2>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-surface-2 text-text-muted hover:text-text-primary transition-smooth">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {(['providers', 'plugins', 'general', 'memory', 'updates', 'about'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 min-w-[4.5rem] h-10 px-3 text-[13px] font-medium transition-smooth ${
                    activeTab === tab
                      ? 'text-text-primary border-b border-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === 'providers' && (
                <div className="h-full flex flex-col min-h-0">
                  <div className="shrink-0 px-4 pt-4 pb-2 space-y-2">
                    <input
                      type="text"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Search providers…"
                      className="h-9 w-full px-3 text-[13px] bg-surface-2 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
                    />
                    <p className="text-[12px] text-text-muted">
                      Add a provider, then paste a key. Only added providers show in the model picker.
                    </p>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2">
                    {(() => {
                      const enabled = enabledProviderIds(config)
                      const q = providerSearch.trim().toLowerCase()
                      const matches = PROVIDER_CATALOG.filter(
                        (p) => !q || p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
                      )
                      if (matches.length === 0) {
                        return <p className="text-[12px] text-text-muted py-2">No providers match that search.</p>
                      }
                      return matches.map((meta) => {
                        const name = meta.id
                        const added = enabled.includes(name)
                        return (
                          <div key={name} className="bg-surface-2 rounded-lg p-3">
                            <div className="h-7 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                              <span className="text-[13px] font-medium text-text-primary">{meta.label}</span>
                              {added && <span className="text-[11px] text-text-muted">Added</span>}
                              {name === 'pollinations' && added && (
                                <span
                                  className={`text-[11px] ${
                                    pollinationsStatus?.connected
                                      ? 'text-emerald-400'
                                      : 'text-red-400'
                                  }`}
                                >
                                  {pollinationsStatus == null
                                    ? 'Checking…'
                                    : pollinationsStatus.connected
                                      ? 'Connected'
                                      : pollinationsStatus.error === 'No API key'
                                        ? 'No key'
                                        : pollinationsStatus.error === 'Backend offline'
                                          ? 'Backend offline'
                                          : 'Invalid key'}
                                </span>
                              )}
                              <span className="ml-auto flex items-center gap-3">
                                {meta.keyUrl && (
                                  <a
                                    href={meta.keyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[12px] leading-6 text-text-secondary hover:text-text-primary"
                                  >
                                    Get key
                                  </a>
                                )}
                                {added ? (
                                  name !== 'pollinations' && (
                                    <button
                                      onClick={() => {
                                        const next = removeEnabledProvider(config, name)
                                        setConfig(next)
                                        persistConfig(next)
                                        if (currentProvider === name) {
                                          const fallback = next.providers.pollinations?.models[0]
                                          setModel(fallback?.id || 'gpt-5.6-sol', 'pollinations')
                                        }
                                      }}
                                      className="text-[12px] leading-6 text-text-muted hover:text-danger"
                                    >
                                      Remove
                                    </button>
                                  )
                                ) : (
                                  <button
                                    onClick={() => {
                                      const next = addEnabledProvider(config, name)
                                      setConfig(next)
                                      persistConfig(next)
                                      setKeys((prev) => ({ ...prev, [name]: next.providers[name]?.api_key || '' }))
                                    }}
                                    className="h-7 px-3 rounded-md border border-border text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-3"
                                  >
                                    Add
                                  </button>
                                )}
                              </span>
                            </div>
                            {added && (
                              <>
                              <input
                                type={name === 'ollama' ? 'text' : 'password'}
                                value={name === 'ollama' ? (config.providers[name]?.base_url || keys[name] || '') : (keys[name] || '')}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (name === 'ollama') {
                                    const next = {
                                      ...config,
                                      providers: {
                                        ...config.providers,
                                        [name]: { ...config.providers[name], base_url: value },
                                      },
                                    }
                                    setConfig(next)
                                  } else {
                                    setKeys((prev) => ({ ...prev, [name]: value }))
                                  }
                                }}
                                placeholder={meta.placeholder}
                                className="h-9 w-full mt-2 px-3 text-[13px] bg-surface-1 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
                              />
                              {name === 'pollinations' && (
                                <p className="text-[11px] text-text-muted mt-1.5 leading-4">
                                  Use a secret key starting with sk_ from the Get key link. Save after pasting. App keys (pk_) are for websites, not this app.
                                </p>
                              )}
                              </>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                  <div className="shrink-0 px-4 py-3 border-t border-border">
                    <button
                      onClick={() => void handleSave()}
                      className="w-full h-9 text-[13px] font-medium rounded-md bg-accent hover:bg-accent-hover text-accent-ink transition-smooth"
                    >
                      {saved ? 'Saved' : 'Save API keys'}
                    </button>
                    {saveError && <p className="text-[12px] text-red-400 mt-2">{saveError}</p>}
                  </div>
                </div>
              )}

              {activeTab === 'plugins' && (
                <div className="h-full flex flex-col min-h-0">
                  <div className="shrink-0 px-4 pt-4 pb-2 space-y-2">
                    <input
                      type="text"
                      value={pluginSearch}
                      onChange={(e) => setPluginSearch(e.target.value)}
                      placeholder="Search marketplace…"
                      className="h-9 w-full px-3 text-[13px] bg-surface-2 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
                    />
                    <p className="text-[12px] text-text-muted">
                      Installed plugins add instructions to the next prompt. Use /caveman, /goal, /plan, or /swarm. Goal, Plan, and Swarm work as slash commands; Plan cannot run with Goal or Swarm.
                    </p>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
                    {marketplaceSearch(pluginSearch).map((plugin) => {
                      const installed = installedPluginIds(config).includes(plugin.id)
                      return (
                        <div key={plugin.id} className="bg-surface-2 rounded-lg p-3">
                          <div className="h-7 flex items-center gap-2">
                            <span className="text-[13px] font-medium text-text-primary">{plugin.name}</span>
                            <span className="font-mono text-[12px] text-text-muted">{plugin.command}</span>
                            <button
                              onClick={() => {
                                const next = installed ? uninstallPlugin(config, plugin.id) : installPlugin(config, plugin.id)
                                setConfig(next)
                                persistConfig(next)
                              }}
                              className="ml-auto h-7 px-3 rounded-md border border-border text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-3"
                            >
                              {installed ? 'Uninstall' : 'Install'}
                            </button>
                          </div>
                          <p className="text-[12px] text-text-muted mt-1.5 leading-5">{plugin.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'general' && (
                <div className="h-full overflow-y-auto p-4 space-y-4">
                  <div className="bg-surface-2 rounded-lg p-4">
                    <div className="text-xs font-medium text-text-primary">Theme</div>
                    <div className="text-[10px] text-text-muted mt-0.5 mb-3">Dark is default. Light and Slate change the whole window.</div>
                    <div className="flex gap-1">
                      {THEME_IDS.map((id) => {
                        const on = (config.theme || 'dark') === id
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              const cfg = useStore.getState().config
                              const next = { ...cfg, theme: id as ThemeId }
                              setConfig(next)
                              persistConfig(next)
                              applyTheme(id)
                            }}
                            className={`h-8 px-3 text-[12px] rounded-md border capitalize transition-smooth ${
                              on
                                ? 'bg-surface-3 text-text-primary border-border'
                                : 'bg-surface-1 text-text-muted border-border hover:text-text-primary'
                            }`}
                          >
                            {id}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-surface-2 rounded-lg p-4">
                    <div className="text-xs font-medium text-text-primary">Ask vs Agent</div>
                    <div className="text-[10px] text-text-muted mt-0.5 mb-3">Ask answers and inspects. Agent can write files and run commands.</div>
                    <div className="flex gap-1">
                      {(['ask', 'agent'] as const).map((id) => {
                        const on = (config.agent_mode || 'agent') === id
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              const cfg = useStore.getState().config
                              const next = { ...cfg, agent_mode: id }
                              setConfig(next)
                              persistConfig(next)
                            }}
                            className={`h-8 px-3 text-[12px] rounded-md border capitalize transition-smooth ${
                              on
                                ? 'bg-surface-3 text-text-primary border-border'
                                : 'bg-surface-1 text-text-muted border-border hover:text-text-primary'
                            }`}
                          >
                            {id}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-surface-2 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-text-primary">Auto-approve all tools</div>
                        <div className="text-[10px] text-text-muted mt-0.5">Skip approval prompts for shell commands and file writes</div>
                      </div>
                      <button
                        onClick={() => {
                          const cfg = useStore.getState().config
                          setConfig({ ...cfg, auto_approve: !cfg.auto_approve })
                          apiFetch('http://127.0.0.1:8765/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...cfg, auto_approve: !cfg.auto_approve }),
                          }).catch(() => {})
                        }}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          config.auto_approve ? 'bg-accent' : 'bg-surface-3'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            config.auto_approve ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface-2 rounded-lg p-4">
                    <div className="text-xs font-medium text-text-primary">Model list</div>
                    <div className="text-[10px] text-text-muted mt-0.5 mb-3">
                      Popular is the default. All shows every live model. Only Free hides paid ones.
                    </div>
                    <div className="flex gap-1">
                      {([
                        { id: 'popular', label: 'Popular' },
                        { id: 'all', label: 'All' },
                        { id: 'free', label: 'Only Free' },
                      ] as const).map((opt) => {
                        const on = resolveModelList(config) === opt.id
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              const cfg = useStore.getState().config
                              const mode = opt.id as ModelListMode
                              const next = { ...cfg, model_list: mode, free_models_only: mode === 'free' }
                              setConfig(next)
                              persistConfig(next)
                              if (mode === 'free') {
                                const models = next.providers[currentProvider]?.models || []
                                const current = useStore.getState().currentModel
                                const stillVisible = models.some((m) => m.id === current && isFreeModel(m))
                                if (!stillVisible) {
                                  const fallback = models.find(isFreeModel) || models[0]
                                  if (fallback) setModel(fallback.id, currentProvider)
                                }
                              }
                            }}
                            className={`h-8 px-3 text-[12px] rounded-md border transition-smooth ${
                              on
                                ? 'bg-surface-3 text-text-primary border-border'
                                : 'bg-surface-1 text-text-muted border-border hover:text-text-primary'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-surface-2 rounded-lg p-4">
                    <div className="text-xs font-medium text-text-primary mb-2">Temperature</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={config.temperature}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          const cfg = useStore.getState().config
                          setConfig({ ...cfg, temperature: val })
                        }}
                        onMouseUp={() => {
                          apiFetch('http://127.0.0.1:8765/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(config),
                          }).catch(() => {})
                        }}
                        className="flex-1 accent-accent"
                      />
                      <span className="text-xs text-text-secondary font-mono w-8 text-right">{config.temperature}</span>
                    </div>
                  </div>

                  <div className="bg-surface-2 rounded-lg p-4">
                    <div className="text-xs font-medium text-text-primary mb-2">Max tokens</div>
                    <input
                      type="number"
                      value={config.max_tokens}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 4096
                        const cfg = useStore.getState().config
                        setConfig({ ...cfg, max_tokens: val })
                      }}
                      onBlur={() => {
                        apiFetch('http://127.0.0.1:8765/config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(config),
                        }).catch(() => {})
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-surface-1 border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'memory' && (
                <div className="h-full min-h-0">
                  <MemoryPanel />
                </div>
              )}

              {activeTab === 'updates' && (
                <div className="h-full min-h-0">
                  <UpdatesPanel />
                </div>
              )}

              {activeTab === 'about' && (
                <div className="h-full overflow-y-auto flex items-center justify-center p-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-text-primary mb-1">Nexum</div>
                    <div className="text-xs text-text-muted mb-4 font-mono">Version {appVersion}</div>
                    <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                      AI-powered coding assistant with multi-provider support. Built with Electron, React, and Python.
                    </p>
                    <button
                      onClick={() => setActiveTab('updates')}
                      className="mt-4 text-[11px] text-accent hover:underline"
                    >
                      Check for updates
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
