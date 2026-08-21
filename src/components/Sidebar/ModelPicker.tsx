import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/store'

const PROVIDER_COLORS: Record<string, string> = {
  pollinations: '#ff3b30',
  openai: '#00c950',
  anthropic: '#ff7a00',
  google: '#0091ff',
  ollama: '#ffcc00',
  openrouter: '#00e6ff',
}

const PROVIDER_LABELS: Record<string, string> = {
  pollinations: 'Pollinations (Free)',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Ollama (Local)',
  openrouter: 'OpenRouter',
}

function PollenBalance() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const currentProvider = useStore((s) => s.currentProvider)

  const fetchBalance = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('http://127.0.0.1:8765/pollinations/balance')
      const data = await resp.json()
      setBalance(data.balance ?? null)
    } catch {
      setBalance(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (currentProvider === 'pollinations') {
      fetchBalance()
      const interval = setInterval(fetchBalance, 30_000)
      return () => clearInterval(interval)
    }
  }, [currentProvider, fetchBalance])

  if (currentProvider !== 'pollinations') return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 mx-3 mb-2 rounded-lg bg-surface-2/60 border border-border/50">
      <div className="w-1.5 h-1.5 rounded-full bg-pollinations animate-pulse-dot shrink-0" />
      <span className="text-[10px] text-text-muted uppercase tracking-wider">Pollen</span>
      <span className="ml-auto text-sm font-mono text-text-primary font-medium tabular-nums">
        {loading ? (
          <span className="inline-block w-8 h-3 bg-surface-3 rounded animate-pulse" />
        ) : balance !== null ? (
          balance.toLocaleString()
        ) : (
          <span className="text-text-muted text-xs">—</span>
        )}
      </span>
    </div>
  )
}

export default function ModelPicker() {
  const currentModel = useStore((s) => s.currentModel)
  const currentProvider = useStore((s) => s.currentProvider)
  const config = useStore((s) => s.config)
  const setModel = useStore((s) => s.setModel)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allModels: { provider: string; model: { id: string; name: string; cost_per_1k: number } }[] = []
  for (const [provider, cfg] of Object.entries(config.providers)) {
    for (const m of cfg.models || []) {
      allModels.push({ provider, model: m })
    }
  }

  const filtered = allModels.filter(
    (m) =>
      m.model.name.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
  )

  const grouped: Record<string, typeof filtered> = {}
  for (const m of filtered) {
    if (!grouped[m.provider]) grouped[m.provider] = []
    grouped[m.provider].push(m)
  }

  const sortedProviders = Object.keys(grouped).sort((a, b) => {
    if (a === 'pollinations') return -1
    if (b === 'pollinations') return 1
    return a.localeCompare(b)
  })

  const currentModelObj = allModels.find(
    (m) => m.model.id === currentModel && m.provider === currentProvider
  )

  return (
    <div ref={ref} className="relative border-b border-border p-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-smooth text-left"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: PROVIDER_COLORS[currentProvider] || '#888' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-text-muted uppercase tracking-wide">
            {PROVIDER_LABELS[currentProvider] || currentProvider}
          </div>
          <div className="text-sm text-text-primary truncate mt-0.5">
            {currentModelObj?.model.name || currentModel}
          </div>
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`text-text-muted transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l3 3 3-3z" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-3 right-3 mt-2 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <PollenBalance />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-32 px-2 py-1 text-sm bg-surface-1 border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {sortedProviders.length === 0 && (
              <div className="px-3 py-2 text-sm text-text-muted">No models found</div>
            )}
            {sortedProviders.map((provider) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-surface-1/50">
                  {PROVIDER_LABELS[provider] || provider}
                </div>
                {grouped[provider].map(({ model }) => (
                  <button
                    key={`${provider}/${model.id}`}
                    onClick={() => {
                      setModel(model.id, provider)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-smooth ${
                      currentModel === model.id && currentProvider === provider
                        ? 'bg-accent-muted text-accent'
                        : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                    }`}
                    title={`${model.name} — ${model.cost_per_1k === 0 ? 'Free' : `$${model.cost_per_1k}/1k tokens`}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: PROVIDER_COLORS[provider] || '#888' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{model.name}</div>
                    </div>
                    {model.cost_per_1k === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-medium shrink-0">
                        FREE
                      </span>
                    )}
                    {currentModel === model.id && currentProvider === provider && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-accent shrink-0">
                        <path d="M5.5 9.5L2.5 6.5l1-1 2 2 5-5 1 1z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
