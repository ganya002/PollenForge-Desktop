import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/store'
import UpdatesPanel from './UpdatesPanel'
import { PROVIDER_CATALOG, catalogEntry } from '../../lib/providerCatalog'
import {
  addEnabledProvider,
  enabledProviderIds,
  persistConfig,
  removeEnabledProvider,
} from '../../lib/appConfig'
import { marketplaceSearch, installPlugin, uninstallPlugin, installedPluginIds } from '../../lib/plugins'

export type SettingsTab = 'providers' | 'plugins' | 'general' | 'updates' | 'about'

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
  const [appVersion, setAppVersion] = useState('…')
  const [providerSearch, setProviderSearch] = useState('')
  const [pluginSearch, setPluginSearch] = useState('')

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      const initial: Record<string, string> = {}
      for (const [name, cfg] of Object.entries(config.providers)) {
        initial[name] = cfg.api_key || ''
      }
      setKeys(initial)
      setSaved(false)
      setProviderSearch('')
      setPluginSearch('')
      window.api?.app?.getVersion?.()
        .then((info) => setAppVersion(info.version))
        .catch(() => {})
    }
  }, [open, config, initialTab])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleSave = () => {
    const updatedProviders = { ...config.providers }
    for (const [name, key] of Object.entries(keys)) {
      if (updatedProviders[name]) {
        updatedProviders[name] = { ...updatedProviders[name], api_key: key }
      }
    }
    const next = { ...config, providers: updatedProviders }
    setConfig(next)
    persistConfig(next)

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
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-xl bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between h-12 px-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-text-primary">Settings</h2>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-surface-2 text-text-muted hover:text-text-primary transition-smooth">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-border">
              {(['providers', 'plugins', 'general', 'updates', 'about'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 h-10 px-4 text-[13px] font-medium transition-smooth ${
                    activeTab === tab
                      ? 'text-text-primary border-b border-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[28rem] overflow-y-auto">
              {activeTab === 'providers' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    placeholder="Search providers to add…"
                    className="h-9 w-full px-3 text-[13px] bg-surface-2 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
                  />
                  {(() => {
                    const enabled = enabledProviderIds(config)
                    const q = providerSearch.trim().toLowerCase()
                    const matches = PROVIDER_CATALOG.filter(
                      (p) =>
                        !enabled.includes(p.id) &&
                        (!q || p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)),
                    )
                    if (!q) {
                      return (
                        <p className="text-[12px] text-text-muted px-0.5">
                          Type a name (OpenAI, Groq, DeepSeek…) then add it. Only added providers show models.
                        </p>
                      )
                    }
                    if (matches.length === 0) {
                      return <p className="text-[12px] text-text-muted">No providers match that search.</p>
                    }
                    return matches.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          const next = addEnabledProvider(config, p.id)
                          setConfig(next)
                          persistConfig(next)
                          setKeys((prev) => ({ ...prev, [p.id]: next.providers[p.id]?.api_key || '' }))
                          setProviderSearch('')
                        }}
                        className="w-full h-10 flex items-center gap-2.5 px-3 rounded-md bg-surface-2 border border-border hover:border-border-hover text-left"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="flex-1 text-[13px] text-text-primary">{p.label}</span>
                        <span className="text-[12px] text-text-muted">Add</span>
                      </button>
                    ))
                  })()}

                  {enabledProviderIds(config).map((name) => {
                    const meta = catalogEntry(name)
                    if (!meta) return null
                    return (
                      <div key={name} className="bg-surface-2 rounded-lg p-3">
                        <div className="h-6 flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                          <span className="text-[13px] font-medium text-text-primary">{meta.label}</span>
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
                            {name !== 'pollinations' && (
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
                            )}
                          </span>
                        </div>
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
                          className="h-9 w-full px-3 text-[13px] bg-surface-1 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
                        />
                      </div>
                    )
                  })}

                  <button
                    onClick={handleSave}
                    className="w-full h-9 mt-1 text-[13px] font-medium rounded-md bg-accent hover:bg-accent-hover text-accent-ink transition-smooth"
                  >
                    {saved ? 'Saved' : 'Save API keys'}
                  </button>
                </div>
              )}

              {activeTab === 'plugins' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={pluginSearch}
                    onChange={(e) => setPluginSearch(e.target.value)}
                    placeholder="Search marketplace…"
                    className="h-9 w-full px-3 text-[13px] bg-surface-2 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
                  />
                  <p className="text-[12px] text-text-muted">
                    Installed plugins add instructions to the next prompt. Use /caveman or /goal in the chat box.
                  </p>
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
              )}

              {activeTab === 'general' && (
                <div className="space-y-4">
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
                          fetch('http://127.0.0.1:8765/config', {
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
                          fetch('http://127.0.0.1:8765/config', {
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
                        fetch('http://127.0.0.1:8765/config', {
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

              {activeTab === 'updates' && <UpdatesPanel />}

              {activeTab === 'about' && (
                <div className="text-center py-4">
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
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
