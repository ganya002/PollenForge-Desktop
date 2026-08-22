import { useStore, type Session } from '../store/store'
import { sortSessions } from './chatActions'
import { normalizeSession } from './sessionMeta'
import { titleFromPrompt } from './chatTitle'

export { normalizeSession, sessionTimestampMs } from './sessionMeta'

export async function refreshSessions(): Promise<void> {
  try {
    const res = await fetch('http://127.0.0.1:8765/sessions')
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) {
      useStore.getState().setSessions(
        sortSessions(data.map((item) => normalizeSession(item as Record<string, unknown>) as Session)),
      )
    }
  } catch {
    /* ignore */
  }
}

export async function nameSessionFromPrompt(sessionId: string, content: string): Promise<void> {
  const name = titleFromPrompt(content)
  if (!sessionId || !name) return
  const current = useStore.getState().sessions.find((s) => s.id === sessionId)
  if (current && titleFromPrompt(current.name)) return
  try {
    await fetch(`http://127.0.0.1:8765/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const sessions = useStore.getState().sessions
    useStore.getState().setSessions(sessions.map((s) => (s.id === sessionId ? { ...s, name, preview: content } : s)))
  } catch {
    /* ignore */
  }
}

export async function setSessionArchived(sessionId: string, archived: boolean): Promise<void> {
  if (!sessionId) return
  try {
    await fetch(`http://127.0.0.1:8765/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    })
    const sessions = useStore.getState().sessions
    useStore.getState().setSessions(sortSessions(sessions.map((s) => (s.id === sessionId ? { ...s, archived } : s))))
  } catch {
    /* ignore */
  }
}

export async function setSessionPinned(sessionId: string, pinned: boolean): Promise<void> {
  if (!sessionId) return
  try {
    await fetch(`http://127.0.0.1:8765/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    })
    const sessions = useStore.getState().sessions
    useStore.getState().setSessions(sortSessions(sessions.map((s) => (s.id === sessionId ? { ...s, pinned } : s))))
  } catch {
    /* ignore */
  }
}
