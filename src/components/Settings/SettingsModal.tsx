import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/store'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

const PROVIDER_META: Record<string, { label: string; placeholder: string; color: string; keyUrl?: string }> = {
  pollinations: { label: 'Pollinations', placeholder: 'sk_...', color: '#ff3b30', keyUrl: 'https://enter.pollinations.ai/keys' },
  openai: { label: 'OpenAI', placeholder: 'sk-...', color: '#00c950', keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...', color: '#ff7a00', keyUrl: 'https://console.anthropic.com/' },
  google: { label: 'Google', placeholder: 'AIza...', color: '#0091ff', keyUrl: 'https://aistudio.google.com/apikey' },
  ollama: { label: 'Ollama', placeholder: 'http://localhost:11434', color: '#ffcc00' },
  openrouter: { label: 'OpenRouter', placeholder: 'sk-or-...', color: '#00e6ff', keyUrl: 'https://openrouter.ai/keys' },
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'general' | 'about'>('providers')
  const config = useStore((s) => s.config)
  const setConfig = useStore((s) => s.setConfig)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      for (const [name, cfg] of Object.entries(config.providers)) {
        initial[name] = cfg.api_key || ''
      }
      setKeys(initial)
      setSaved(false)
    }
  }, [open, config])

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
    setConfig({ ...config, providers: updatedProviders })

    fetch('http://127.0.0.1:8765/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, providers: updatedProviders }),
    }).catch(() => {})

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
            className="relative w-full max-w-lg bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
              <button onClick={onClose} className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-smooth">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-border">
              {(['providers', 'general', 'about'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2 text-xs font-medium transition-smooth ${
                    activeTab === tab
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              {activeTab === 'providers' && (
                <div className="space-y-3">
                  {Object.entries(PROVIDER_META).map(([name, meta]) => (
                    <div key={name} className="bg-surface-2 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                        <span className="text-xs font-medium text-text-primary">{meta.label}</span>
                        {meta.keyUrl && (
                          <a
                            href={meta.keyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-[10px] text-accent hover:underline"
                          >
                            Get key
                          </a>
                        )}
                      </div>
                      <input
                        type="password"
                        value={keys[name] || ''}
                        onChange={(e) => setKeys((prev) => ({ ...prev, [name]: e.target.value }))}
                        placeholder={meta.placeholder}
                        className="w-full px-3 py-1.5 text-xs bg-surface-1 border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                  ))}

                  <button
                    onClick={handleSave}
                    className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-lg bg-accent hover:bg-accent-hover text-white transition-smooth"
                  >
                    {saved ? 'Saved!' : 'Save API Keys'}
                  </button>
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

              {activeTab === 'about' && (
                <div className="text-center py-4">
                  <div className="text-lg font-semibold text-text-primary mb-1">PollenForge</div>
                  <div className="text-xs text-text-muted mb-4">Version 1.0.0</div>
                  <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                    AI-powered coding assistant with multi-provider support. Built with Electron, React, and Python.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
