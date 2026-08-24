import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

type MemoryItem = { id: string; text: string; created_at?: number }

const API = 'http://127.0.0.1:8765/memory'

export default function MemoryPanel() {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const res = await apiFetch(API)
      if (!res.ok) throw new Error('Could not load memory')
      const data = await res.json()
      setItems(Array.isArray(data.memories) ? data.memories : [])
      setError('')
    } catch {
      setError('Memory is unavailable until the backend is up.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const add = async () => {
    const text = draft.trim()
    if (!text) return
    try {
      const res = await apiFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('save failed')
      setDraft('')
      await refresh()
    } catch {
      setError('Could not save that note.')
    }
  }

  const remove = async (id: string) => {
    try {
      await apiFetch(`${API}/${id}`, { method: 'DELETE' })
      await refresh()
    } catch {
      setError('Could not delete that note.')
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <div className="text-[13px] font-medium text-text-primary">Memory</div>
        <p className="text-[12px] text-text-muted mt-1 leading-5">
          Notes the agent keeps across chats. You can add or delete them here. The model can also call remember / forget_memory.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void add()
            }
          }}
          placeholder="e.g. Prefer uv, never pip into Homebrew"
          className="flex-1 h-9 px-3 text-[13px] bg-surface-2 border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="h-9 px-3 rounded-md border border-border text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-3"
        >
          Add
        </button>
      </div>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
      <div className="space-y-2">
        {items.length === 0 && !error && (
          <p className="text-[12px] text-text-muted">No memories yet.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="bg-surface-2 rounded-lg px-3 py-2 flex items-start gap-2">
            <p className="flex-1 min-w-0 text-[13px] text-text-primary leading-5">{item.text}</p>
            <button
              type="button"
              onClick={() => void remove(item.id)}
              className="shrink-0 text-[11px] text-text-muted hover:text-danger"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
