import type { Message, Session } from '../store/store'
import { normalizeSession } from './sessionMeta.ts'

export const LAST_SESSION_KEY = 'nx-session-id'

export function rememberSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_SESSION_KEY, id)
    else localStorage.removeItem(LAST_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function rememberedSessionId(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_KEY)
  } catch {
    return null
  }
}

export function newSessionId(): string {
  const bytes = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function userPreview(messages: Array<{ role?: string; content?: string }>): string {
  for (const item of messages || []) {
    if (item?.role !== 'user') continue
    const text = String(item.content || '').trim()
    if (text) return text.slice(0, 200)
  }
  return ''
}

export function visibleSessionMessages(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }))
}

export function sessionFilePayload(
  messages: Message[],
  meta: { name?: string; directory?: string; pinned?: boolean; archived?: boolean; created_at?: number },
): { messages: Array<{ role: string; content: string }>; meta: Record<string, unknown> } {
  const visible = visibleSessionMessages(messages)
  return {
    messages: visible,
    meta: {
      name: meta.name || 'Untitled',
      updated_at: Date.now() / 1000,
      created_at: meta.created_at || Date.now() / 1000,
      directory: meta.directory || '',
      pinned: !!meta.pinned,
      archived: !!meta.archived,
    },
  }
}

export function summaryFromSessionFile(id: string, raw: Record<string, unknown>, fallbackModified = ''): Session {
  const meta = (raw.meta && typeof raw.meta === 'object' ? raw.meta : {}) as Record<string, unknown>
  const messages = Array.isArray(raw.messages) ? raw.messages : []
  return normalizeSession({
    id,
    name: meta.name,
    message_count: messages.length,
    updated_at: meta.updated_at,
    modified: fallbackModified,
    directory: meta.directory,
    preview: userPreview(messages as Array<{ role?: string; content?: string }>),
    pinned: meta.pinned,
    archived: meta.archived,
  })
}

export function mergeSessionLists(disk: Session[], live: Session[]): Session[] {
  const map = new Map<string, Session>()
  for (const session of disk) {
    if (session.id) map.set(session.id, session)
  }
  for (const session of live) {
    if (session.id) map.set(session.id, session)
  }
  return [...map.values()]
}
