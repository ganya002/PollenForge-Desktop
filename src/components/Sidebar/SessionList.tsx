import { useEffect, useRef, useState } from 'react'
import { useStore, Session } from '../../store/store'
import { sessionMatches } from '../../lib/chatActions'
import { refreshSessions, sessionTimestampMs, setSessionArchived, setSessionPinned, loadSession, createChatSession, deleteChatSession, persistCurrentSession } from '../../lib/sessions'
import { displaySessionTitle, relativeTime } from '../../lib/chatTitle'
import { folderName, pickAndSetProjectFolder, refreshFileTree } from '../../lib/workspace'

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
  const showArchived = useStore((s) => s.showArchived)

  const visible = sessions.filter((s) => (showArchived ? !!s.archived : !s.archived) && sessionMatches(s, query, displaySessionTitle(s)))
  const archivedCount = sessions.filter((s) => s.archived).length
  const grouped = groupSessions(visible)

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  const handleNew = async () => {
    const id = await createChatSession('New Chat')
    if (!id) return
    setCurrentSessionId(id)
    clearMessages()
    await refreshSessions()
    await refreshFileTree()
  }

  const handleLoad = async (id: string) => {
    if (renamingId === id) return
    await persistCurrentSession()
    await loadSession(id)
    await refreshFileTree()
  }

  const handleDelete = async (id: string) => {
    await deleteChatSession(id)
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
        <div className="relative">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          >
            <circle cx="5.2" cy="5.2" r="3.4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7.7 7.7L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-full pl-7 pr-2.5 rounded-md bg-transparent border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover"
          />
        </div>
        {archivedCount > 0 && (
          <button
            onClick={() => useStore.getState().setShowArchived(!showArchived)}
            className="mt-1.5 w-full h-7 px-2 rounded-md text-left text-[11px] text-text-muted hover:text-text-secondary hover:bg-surface-2"
          >
            {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-1.5 pb-2">
        {sessions.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-text-muted">No chats yet</div>
        )}
        {sessions.length > 0 && visible.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-text-muted">
            {showArchived ? 'No archived chats' : archivedCount ? 'No matching chats. Show archived to see older ones.' : 'No matching chats'}
          </div>
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
                const meta = [project, when].filter(Boolean).join(' · ')
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
                    className={`relative w-full text-left rounded-md pl-3 pr-2 py-2 cursor-pointer transition-smooth ${
                      active
                        ? 'bg-surface-2 text-text-primary'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-px bg-text-primary/70 animate-fade-in" />
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
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`truncate leading-5 text-[13px] tracking-[-0.01em] ${active ? 'font-medium text-text-primary' : ''}`}>
                            {title}
                          </div>
                          {s.pinned && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-text-muted" aria-hidden>
                              <path d="M3.2 4.1l2.7-2.7 2.7 2.7-1.1 1.1-1 .3V8.6L4.3 7.2V5.5l-1-.3L3.2 4.1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        {meta && (
                          <div className="truncate text-[11px] leading-4 text-text-muted mt-0.5" title={s.directory || undefined}>
                            {meta}
                          </div>
                        )}
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
              onClick={() => {
                const current = useStore.getState().sessions.find((s) => s.id === contextMenu.id)
                void setSessionArchived(contextMenu.id, !current?.archived)
                setContextMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-smooth"
            >
              {useStore.getState().sessions.find((s) => s.id === contextMenu.id)?.archived ? 'Unarchive' : 'Archive'}
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
