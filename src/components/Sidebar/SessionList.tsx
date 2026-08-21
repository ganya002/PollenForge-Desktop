import { useEffect, useRef, useState } from 'react'
import { useStore, Session } from '../../store/store'

function groupSessions(sessions: Session[]) {
  const now = new Date()
  const today = now.toDateString()
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterday = yesterdayDate.toDateString()

  const groups: Record<string, Session[]> = { Today: [], Yesterday: [], Earlier: [] }
  for (const s of sessions) {
    const d = new Date(s.modified || s.updated_at || 0).toDateString()
    if (d === today) groups.Today.push(s)
    else if (d === yesterday) groups.Yesterday.push(s)
    else groups.Earlier.push(s)
  }
  return groups
}

export default function SessionList() {
  const sessions = useStore((s) => s.sessions)
  const currentSessionId = useStore((s) => s.currentSessionId)
  const setCurrentSessionId = useStore((s) => s.setCurrentSessionId)
  const clearMessages = useStore((s) => s.clearMessages)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const grouped = groupSessions(sessions)

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  const handleNew = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Chat' }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCurrentSessionId(data.id)
      clearMessages()
      const list = await fetch('http://127.0.0.1:8765/sessions').then(r => r.json()).catch(() => null)
      if (Array.isArray(list)) useStore.getState().setSessions(list)
    } catch (e) {
      console.error('Failed to create session:', e)
    }
  }

  const handleLoad = async (id: string) => {
    if (renamingId === id) return
    setCurrentSessionId(id)
    try {
      const res = await fetch(`http://127.0.0.1:8765/sessions/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.messages) {
        useStore.getState().loadSessionMessages(data.messages)
      }
    } catch (e) {
      console.error('Failed to load session:', e)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8765/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const curSessions = useStore.getState().sessions
      useStore.getState().setSessions(curSessions.filter((s) => s.id !== id))
      if (currentSessionId === id) {
        setCurrentSessionId(null)
        clearMessages()
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
    setContextMenu(null)
  }

  const startRename = (id: string) => {
    const current = useStore.getState().sessions.find((s) => s.id === id)
    setRenameValue(current?.name || '')
    setRenamingId(id)
    setContextMenu(null)
  }

  const commitRename = async () => {
    const id = renamingId
    const name = renameValue.trim()
    setRenamingId(null)
    if (!id || !name) return
    try {
      await fetch(`http://127.0.0.1:8765/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const cur = useStore.getState().sessions
      useStore.getState().setSessions(cur.map((s) => (s.id === id ? { ...s, name } : s)))
    } catch (e) {
      console.error('Failed to rename session:', e)
    }
  }

  return (
    <div className="flex flex-col border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Sessions</span>
        <button
          onClick={handleNew}
          className="no-drag p-1 rounded hover:bg-surface-2 transition-smooth text-text-muted hover:text-accent"
          aria-label="New chat"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {Object.entries(grouped).map(([label, items]) =>
          items.length > 0 ? (
            <div key={label}>
              <div className="px-3 py-1 text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</div>
              {items.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleLoad(s.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, id: s.id })
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-smooth ${
                    currentSessionId === s.id
                      ? 'bg-accent-muted text-accent'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  {renamingId === s.id ? (
                    <input
                      ref={renameRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.stopPropagation()
                          void commitRename()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingId(null)
                        }
                      }}
                      onBlur={() => void commitRename()}
                      className="h-7 w-full px-1.5 text-[13px] bg-surface-1 border border-border rounded-md text-text-primary focus:outline-none focus:border-border-hover"
                    />
                  ) : (
                    <>
                      <div className="truncate">{s.name}</div>
                      <div className="text-[10px] text-text-muted">{s.message_count} messages</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null
        )}
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-surface-3 border border-border rounded-lg shadow-xl py-1 min-w-[120px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => startRename(contextMenu.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-smooth"
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(contextMenu.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10 transition-smooth"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
