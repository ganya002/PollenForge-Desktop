export type ThemeId = 'dark' | 'light' | 'slate'
export type AgentMode = 'ask' | 'agent'

export const THEME_IDS: ThemeId[] = ['dark', 'light', 'slate']

export function normalizeTheme(raw: unknown): ThemeId {
  return THEME_IDS.includes(raw as ThemeId) ? (raw as ThemeId) : 'dark'
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function normalizeAgentMode(raw: unknown): AgentMode {
  return raw === 'ask' ? 'ask' : 'agent'
}

export const ASK_BLOCKED_TOOLS = new Set([
  'write_file',
  'edit_file',
  'delete_file',
  'run_command',
  'close_app',
  'git_commit',
  'git_add',
  'git_push',
  'git_checkout',
  'run_build',
  'start_background_task',
])

export function isAskBlockedTool(name: string): boolean {
  return ASK_BLOCKED_TOOLS.has(name)
}

export const ASK_PROMPT = `ASK MODE is ON. Answer and inspect only.
Do not write, edit, or delete files. Do not run shell commands that change state.
Read-only tools are OK. If the user needs a change, explain the plan and ask them to switch to Agent.`

export function pushPromptHistory(prev: string[], next: string, max = 40): string[] {
  const text = next.trim()
  if (!text) return prev
  return [text, ...prev.filter((item) => item !== text)].slice(0, max)
}

export function messageMatchesFind(content: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (content || '').toLowerCase().includes(q)
}

export function toolPath(args?: Record<string, unknown>): string {
  if (!args) return ''
  return String(args.path || args.file || '')
}

export function isHtmlWriteTool(tool: string, args?: Record<string, unknown>): boolean {
  if (tool !== 'write_file' && tool !== 'edit_file') return false
  return /\.html?$/i.test(toolPath(args))
}

export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown }
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}
