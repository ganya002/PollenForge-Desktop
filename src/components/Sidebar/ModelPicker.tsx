import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/store'
import { catalogEntry, PROVIDER_CATALOG } from '../../lib/providerCatalog'
import {
  addEnabledProvider,
  enabledProviderIds,
  persistConfig,
} from '../../lib/appConfig'
import { formatModelCost, resolveModelList, visibleModels } from '../../lib/modelFilter'

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
    if (currentProvider !== 'pollinations') return
    fetchBalance()
    const interval = setInterval(fetchBalance, 30_000)
    return () => clearInterval(interval)
  }, [currentProvider, fetchBalance])

  if (currentProvider !== 'pollinations') return null

  return (
    <div className="h-8 px-2.5 shrink-0 flex items-center gap-2 rounded-md bg-surface-1 border border-border text-[11px] text-text-muted">
      <span className="uppercase tracking-wide">Pollen</span>
      <span className="font-mono text-text-primary tabular-nums">
        {loading ? '…' : balance !== null ? balance.toLocaleString() : '—'}
      </span>
    </div>
  )
}

export default function ModelPicker() {
  const currentModel = useStore((s) => s.currentModel)
  const currentProvider = useStore((s) => s.currentProvider)
  const config = useStore((s) => s.config)
  const setModel = useStore((s) => s.setModel)
  const setConfig = useStore((s) => s.setConfig)
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

  const enabled = enabledProviderIds(config)
  const q = search.trim().toLowerCase()

  const allModels = enabled.flatMap((provider) =>
    visibleModels(config.providers[provider]?.models || [], resolveModelList(config)).map((model) => ({
      provider,
      model,
    })),
  )

  const filteredModels = allModels.filter(
    (row) =>
      !q ||
      row.model.name.toLowerCase().includes(q) ||
      row.model.id.toLowerCase().includes(q) ||
      (catalogEntry(row.provider)?.label || row.provider).toLowerCase().includes(q),
  )

  const grouped: Record<string, typeof filteredModels> = {}
  for (const row of filteredModels) {
    if (!grouped[row.provider]) grouped[row.provider] = []
    grouped[row.provider].push(row)
  }

  const addable = q
    ? PROVIDER_CATALOG.filter(
        (p) =>
          !enabled.includes(p.id) &&
          (p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)),
      )
    : []

  const currentMeta = catalogEntry(currentProvider)
  const currentModelObj = allModels.find(
    (row) => row.model.id === currentModel && row.provider === currentProvider,
  )

  const addProvider = (id: string) => {
    const next = addEnabledProvider(config, id)
    setConfig(next)
    persistConfig(next)
    const first = next.providers[id]?.models[0]
    if (first) setModel(first.id, id)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative border-b border-border px-3 py-2.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-10 flex items-center gap-2.5 px-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-smooth text-left"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: currentMeta?.color || '#888' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] leading-4 text-text-muted truncate">
            {currentMeta?.label || currentProvider}
          </div>
          <div className="text-[13px] leading-5 text-text-primary truncate">
            {currentModelObj?.model.name || currentModel}
          </div>
        </div>
        {currentModelObj && (
          <span className="text-[10px] text-text-muted shrink-0 tabular-nums" title="Model cost">
            {formatModelCost(currentModelObj.model)}
          </span>
        )}
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
        <div className="absolute top-full left-3 right-3 mt-2 bg-surface-2 border border-border rounded-lg overflow-hidden z-50">
          <div className="flex items-center gap-2 p-2 border-b border-border">
            <PollenBalance />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models or add a provider"
              className="h-8 flex-1 min-w-0 px-2.5 text-[13px] bg-surface-1 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {addable.length > 0 && (
              <div className="border-b border-border">
                <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Add provider
                </div>
                {addable.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProvider(p.id)}
                    className="w-full h-10 flex items-center gap-2.5 px-3 text-left text-[13px] text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="flex-1 truncate">{p.label}</span>
                    <span className="text-[11px] text-text-muted">Add</span>
                  </button>
                ))}
              </div>
            )}
            {enabled.map((provider) => {
              const rows = grouped[provider] || []
              if (q && rows.length === 0) return null
              const meta = catalogEntry(provider)
              return (
                <div key={provider}>
                  <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    {meta?.label || provider}
                  </div>
                  {rows.map(({ model }) => {
                    const active = currentModel === model.id && currentProvider === provider
                    return (
                      <button
                        key={`${provider}/${model.id}`}
                        onClick={() => {
                          setModel(model.id, provider)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={`w-full h-10 flex items-center gap-2.5 px-3 text-left ${
                          active ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.color || '#888' }} />
                        <span className="flex-1 min-w-0 text-[13px] truncate">{model.name}</span>
                        <span
                          className="text-[10px] text-text-muted shrink-0 tabular-nums"
                          title={
                            model.cost_currency === 'pollen'
                              ? 'Pollen per million input/output tokens'
                              : 'USD per million input/output tokens'
                          }
                        >
                          {formatModelCost(model)}
                        </span>
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                            <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {filteredModels.length === 0 && addable.length === 0 && (
              <div className="px-3 py-3 text-[13px] text-text-muted">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
