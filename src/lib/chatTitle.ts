const SKIP_COMMANDS = new Set([
  'cost',
  'help',
  'clear',
  'compact',
  'new',
  'model',
  'search',
  'image',
  'web',
  'file',
  'folder',
  'commit',
  'diff',
  'caveman',
  'plan',
  'goal',
  'swarm',
  'review',
])

const PLACEHOLDER = /^(new chat|untitled|chat)$/i
const MAX_LEN = 42

function collapse(text: string): string {
  return text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function clip(text: string): string {
  if (text.length <= MAX_LEN) return text
  const cut = text.slice(0, MAX_LEN)
  const space = cut.lastIndexOf(' ')
  return `${(space > 16 ? cut.slice(0, space) : cut).trim()}…`
}

export function titleFromPrompt(raw: string): string {
  let text = collapse(raw.split('[File:')[0] || '')
  if (!text) return ''
  if (PLACEHOLDER.test(text)) return ''
  if (/^token usage:/i.test(text)) return ''
  if (/^show available commands/i.test(text)) return ''
  if (text.startsWith('/')) {
    const [cmd, ...rest] = text.slice(1).split(' ')
    const args = rest.join(' ').trim()
    if (SKIP_COMMANDS.has((cmd || '').toLowerCase())) return titleFromPrompt(args)
    text = args || collapse(text.slice(1))
  }
  if (!text || PLACEHOLDER.test(text)) return ''
  return clip(text)
}

export function displaySessionTitle(session: { name?: string; preview?: string }): string {
  return titleFromPrompt(session.name || '') || titleFromPrompt(session.preview || '') || 'New Chat'
}

export function sessionInitial(title: string): string {
  const ch = (title || 'N').replace(/[^A-Za-z0-9]/g, '').charAt(0)
  return (ch || 'N').toUpperCase()
}

export function sessionAccent(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 28% 46%)`
}

export function relativeTime(ts: number, now = Date.now()): string {
  if (!ts) return ''
  const delta = Math.max(0, now - ts)
  if (delta < 60_000) return 'now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`
  if (delta < 24 * 3_600_000) return `${Math.floor(delta / 3_600_000)}h`
  const day = new Date(ts)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(today.getDate() - 1)
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
