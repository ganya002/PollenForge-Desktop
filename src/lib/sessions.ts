import { apiFetch } from './api'
import { useStore, type Session } from '../store/store'
import { sortSessions } from './chatActions'
import { normalizeSession } from './sessionMeta'
import { titleFromPrompt } from './chatTitle'
import {
  mergeSessionLists,
  newSessionId,
  rememberSessionId,
  rememberedSessionId,
  sessionFilePayload,
  summaryFromSessionFile,
} from './sessionPersist'
import { currentWorkspace } from './workspace'

export { normalizeSession, sessionTimestampMs } from './sessionMeta'

const API = 'http://127.0.0.1:8765'

type SessionFile = {
  messages?: Array<{ role: string; content: string }>
  meta?: Record<string, unknown>
}

function electronSessions() {
  return window.api?.sessions
}

async function listFromPython(): Promise<Session[] | null> {
  try {
    const res = await apiFetch(`${API}/sessions`)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data)) return null
    return data.map((item) => normalizeSession(item as Record<string, unknown>) as Session)
  } catch {
    return null
  }
}

async function listFromDisk(): Promise<Session[]> {
  try {
    const result = await electronSessions()?.list?.()
    if (!result?.success || !Array.isArray(result.sessions)) return []
    return result.sessions.map((item) => normalizeSession(item as Record<string, unknown>) as Session)
  } catch {
    return []
  }
}

export async function refreshSessions(): Promise<void> {
  const live = await listFromPython()
  const disk = await listFromDisk()
  const sessions = sortSessions(mergeSessionLists(disk, live || []))
  useStore.getState().setSessions(sessions)
}

export async function persistCurrentSession(): Promise<void> {
  const state = useStore.getState()
  const id = state.currentSessionId
  if (!id || state.messages.length === 0) return
  const current = state.sessions.find((s) => s.id === id)
  const payload = sessionFilePayload(state.messages, {
    name: current?.name || titleFromPrompt(state.messages.find((m) => m.role === 'user')?.content || '') || 'Untitled',
    directory: current?.directory || currentWorkspace() || '',
    pinned: current?.pinned,
    archived: current?.archived,
  })
  try {
    await electronSessions()?.save?.(id, payload)
  } catch {
    /* ignore */
  }
  const summary = summaryFromSessionFile(id, payload as Record<string, unknown>)
  const sessions = useStore.getState().sessions
  if (sessions.some((s) => s.id === id)) {
    useStore.getState().setSessions(sortSessions(sessions.map((s) => (s.id === id ? { ...s, ...summary } : s))))
  } else {
    useStore.getState().setSessions(sortSessions([summary, ...sessions]))
  }
}

export function flushCurrentSession(): void {
  const state = useStore.getState()
  const id = state.currentSessionId
  if (!id || state.messages.length === 0) return
  const current = state.sessions.find((s) => s.id === id)
  const payload = sessionFilePayload(state.messages, {
    name: current?.name || 'Untitled',
    directory: current?.directory || currentWorkspace() || '',
    pinned: current?.pinned,
    archived: current?.archived,
  })
  try {
    electronSessions()?.saveSync?.(id, payload)
  } catch {
    /* ignore */
  }
}

export async function loadSession(id: string): Promise<boolean> {
  rememberSessionId(id)
  useStore.getState().setCurrentSessionId(id)
  try {
    const res = await apiFetch(`${API}/sessions/${id}`)
    if (res.ok) {
      const data = (await res.json()) as SessionFile
      if (Array.isArray(data.messages)) {
        useStore.getState().loadSessionMessages(data.messages)
        return true
      }
    }
  } catch {
    /* backend may be starting */
  }
  try {
    const result = await electronSessions()?.load?.(id)
    const data = result?.data as SessionFile | undefined
    if (result?.success && Array.isArray(data?.messages)) {
      useStore.getState().loadSessionMessages(data.messages)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function createChatSession(name = 'New Chat'): Promise<string | null> {
  const directory = currentWorkspace() || ''
  try {
    const res = await apiFetch(`${API}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, directory }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.id) return String(data.id)
    }
  } catch {
    /* fall through to disk */
  }
  const id = newSessionId()
  const payload = sessionFilePayload([], { name, directory })
  try {
    const result = await electronSessions()?.save?.(id, payload)
    if (result?.success === false) return null
    return id
  } catch {
    return null
  }
}

export async function restoreLastSession(): Promise<void> {
  await refreshSessions()
  const id = rememberedSessionId()
  if (!id) return
  if (!useStore.getState().sessions.some((s) => s.id === id)) return
  if (useStore.getState().messages.length > 0) {
    useStore.getState().setCurrentSessionId(id)
    return
  }
  await loadSession(id)
}

export async function deleteChatSession(id: string): Promise<boolean> {
  let ok = false
  try {
    const res = await apiFetch(`${API}/sessions/${id}`, { method: 'DELETE' })
    ok = res.ok
  } catch {
    /* fall through */
  }
  try {
    const result = await electronSessions()?.delete?.(id)
    if (result?.success) ok = true
  } catch {
    /* ignore */
  }
  if (!ok) return false
  const state = useStore.getState()
  state.setSessions(state.sessions.filter((s) => s.id !== id))
  if (state.currentSessionId === id) {
    rememberSessionId(null)
    state.setCurrentSessionId(null)
    state.clearMessages()
  }
  return true
}

export async function nameSessionFromPrompt(sessionId: string, content: string): Promise<void> {
  const name = titleFromPrompt(content)
  if (!sessionId || !name) return
  const current = useStore.getState().sessions.find((s) => s.id === sessionId)
  if (current && titleFromPrompt(current.name)) return
  try {
    await apiFetch(`${API}/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  } catch {
    /* disk save still keeps the title */
  }
  const sessions = useStore.getState().sessions
  useStore.getState().setSessions(sessions.map((s) => (s.id === sessionId ? { ...s, name, preview: content } : s)))
  void persistCurrentSession()
}

export async function setSessionArchived(sessionId: string, archived: boolean): Promise<void> {
  if (!sessionId) return
  try {
    await apiFetch(`${API}/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    })
  } catch {
    /* ignore */
  }
  const sessions = useStore.getState().sessions
  useStore.getState().setSessions(sortSessions(sessions.map((s) => (s.id === sessionId ? { ...s, archived } : s))))
  if (useStore.getState().currentSessionId === sessionId) void persistCurrentSession()
}

export async function setSessionPinned(sessionId: string, pinned: boolean): Promise<void> {
  if (!sessionId) return
  try {
    await apiFetch(`${API}/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    })
  } catch {
    /* ignore */
  }
  const sessions = useStore.getState().sessions
  useStore.getState().setSessions(sortSessions(sessions.map((s) => (s.id === sessionId ? { ...s, pinned } : s))))
  if (useStore.getState().currentSessionId === sessionId) void persistCurrentSession()
}
