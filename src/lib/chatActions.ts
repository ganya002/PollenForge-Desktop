import type { Message, Session } from '../store/store'
import { isHtmlPath, resolveBrowserUrl } from './browserTargets.ts'

export function compactMessages(messages: Message[], keep = 6): Message[] {
  if (messages.length <= keep + 1) return messages
  const kept = messages.slice(-keep)
  const removed = messages.length - kept.length
  const note: Message = {
    id: 'compact-note',
    role: 'assistant',
    content: `Earlier conversation was compacted (${removed} messages removed). Recent messages are kept.`,
    timestamp: Date.now(),
  }
  return [note, ...kept]
}

export function messagesThroughUser(messages: Message[], userId: string): Message[] {
  const idx = messages.findIndex((m) => m.id === userId)
  if (idx < 0) return messages
  return messages.slice(0, idx)
}

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const pin = Number(!!b.pinned) - Number(!!a.pinned)
    if (pin) return pin
    return (b.updated_at || 0) - (a.updated_at || 0)
  })
}

export function sessionMatches(session: Session, query: string, title: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    title.toLowerCase().includes(q) ||
    (session.name || '').toLowerCase().includes(q) ||
    (session.preview || '').toLowerCase().includes(q) ||
    (session.directory || '').toLowerCase().includes(q)
  )
}

export function htmlUrlFromTool(
  tool: string,
  args: Record<string, unknown> | undefined,
  workspace?: string | null,
): string {
  if (tool !== 'write_file' && tool !== 'edit_file') return ''
  const path = String(args?.path || args?.file || '')
  if (!isHtmlPath(path)) return ''
  return resolveBrowserUrl(path, workspace)
}

export function pushBrowserHistory(url: string, prev: string[], max = 8): string[] {
  const next = (url || '').trim()
  if (!next || next === 'about:blank') return prev
  return [next, ...prev.filter((item) => item !== next)].slice(0, max)
}

export function projectPathFromDrop(files: ArrayLike<{ path?: string; name?: string }>): string {
  const file = files[0]
  const path = file?.path || ''
  if (!path) return ''
  const name = file?.name || path.replace(/\\/g, '/').split('/').pop() || ''
  if (/\.[a-z0-9]{1,10}$/i.test(name)) {
    return path.replace(/[\\/][^\\/]+$/, '')
  }
  return path
}
