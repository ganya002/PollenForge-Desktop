import { useEffect, useRef, useState } from 'react'
import { useStore, Session } from '../../store/store'
import { sessionMatches } from '../../lib/chatActions'
import { refreshSessions, sessionTimestampMs, setSessionPinned } from '../../lib/sessions'
import { displaySessionTitle, relativeTime, sessionAccent, sessionInitial } from '../../lib/chatTitle'
import { currentWorkspace, folderName, pickAndSetProjectFolder, refreshFileTree } from '../../lib/workspace'

function groupSessions(sessions: Session[]) {
  const now = new Date()
  const today = now.toDateString()
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterday = yesterdayDate.toDateString()

  const groups: Record<string, Session[]> = { Pinned: [], Today: [], Yesterday: [], Earlier: [] }
  for (const s of sessions) {
    if (s.pinned) {
      groups.Pinned.push(s)
      continue
    }
    const ts = sessionTimestampMs(s)
    const d = ts ? new Date(ts).toDateString() : ''
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
  const [query, setQuery] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const visible = sessions.filter((s) => sessionMatches(s, query, displaySessionTitle(s)))
  const grouped = groupSessions(visible)

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  const handleNew = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Chat', directory: currentWorkspace() || '' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCurrentSessionId(data.id)
      clearMessages()
      await refreshSessions()
      await refreshFileTree()
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
      await refreshFileTree()
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
    setRenameValue(current ? displaySessionTitle(current) : '')
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
    <div className="flex flex-col border-b border-border min-h-0 max-h-[50%] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 shrink-0">
        <span className="sidebar-label">Chats</span>
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

      <div className="px-2.5 pb-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          className="h-7 w-full px-2 rounded-md bg-surface-1 border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-1.5 pb-2">
        {sessions.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-text-muted">No chats yet</div>
        )}
        {sessions.length > 0 && visible.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-text-muted">No matching chats</div>
        )}
        {Object.entries(grouped).map(([label, items]) =>
          items.length > 0 ? (
            <div key={label} className="mb-1">
              <div className="px-2 pt-2 pb-1 sidebar-label">{label}</div>
              {items.map((s) => {
                const title = displaySessionTitle(s)
                const active = currentSessionId === s.id
                const project = s.directory ? folderName(s.directory) : ''
                const when = relativeTime(sessionTimestampMs(s))
                const meta = [s.pinned ? 'Pinned' : '', project, when].filter(Boolean).join(' · ')
                const accent = sessionAccent(s.id)
                return (
                  <div
                    key={s.id}
                    onClick={() => handleLoad(s.id)}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      startRename(s.id)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ x: e.clientX, y: e.clientY, id: s.id })
                    }}
                    className={`relative w-full text-left rounded-md px-2 py-1.5 cursor-pointer transition-smooth ${
                      active
                        ? 'bg-surface-2 text-text-primary'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: accent }} />
                    )}
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
                        className="h-7 w-full px-1.5 text-[13px] bg-surface-1 border border-border rounded-md text-text-primary focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className="mt-0.5 h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-[10px] font-medium text-white/90"
                          style={{ background: accent }}
                          aria-hidden
                        >
                          {sessionInitial(title)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate leading-5 text-[13px]">{title}</div>
                          {meta && (
                            <div className="truncate text-[11px] leading-4 text-text-muted mt-0.5" title={s.directory || undefined}>
                              {meta}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
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
              onClick={() => {
                const current = useStore.getState().sessions.find((s) => s.id === contextMenu.id)
                void setSessionPinned(contextMenu.id, !current?.pinned)
                setContextMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-smooth"
            >
              {useStore.getState().sessions.find((s) => s.id === contextMenu.id)?.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => {
                setCurrentSessionId(contextMenu.id)
                setContextMenu(null)
                void pickAndSetProjectFolder()
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-smooth"
            >
              Project folder
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
