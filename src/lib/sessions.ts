import { useStore, type Session } from '../store/store'
import { normalizeSession } from './sessionMeta'

export { normalizeSession, sessionTimestampMs } from './sessionMeta'

export async function refreshSessions(): Promise<void> {
  try {
    const res = await fetch('http://127.0.0.1:8765/sessions')
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) {
      useStore.getState().setSessions(data.map((item) => normalizeSession(item as Record<string, unknown>) as Session))
    }
  } catch {
    /* ignore */
  }
}
