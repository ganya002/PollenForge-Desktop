import type { SwarmState, ToolCall } from '../store/store'

const EXPLORE_TOOLS = new Set([
  'read_file',
  'list_dir',
  'read_folder',
  'tree_view',
  'get_file_info',
])

const SEARCH_TOOLS = new Set([
  'search_files',
  'search_code',
  'find_files',
  'find_functions',
  'github_search_code',
  'web_search',
])

const EDIT_TOOLS = new Set(['edit_file', 'write_file', 'delete_file'])
const COMMAND_TOOLS = new Set([
  'run_command',
  'run_tests',
  'run_build',
  'run_linter',
  'start_background_task',
])

export type AgentActivity = {
  headline: string
  summary: string
  detail: string
  current: string
  added: number
  removed: number
  hasWork: boolean
}

export function fileName(path: string): string {
  const parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] || String(path || '')
}

export function lineCount(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

export function countDiffLines(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of String(diff || '').split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) added += 1
    else if (line.startsWith('-') && !line.startsWith('---')) removed += 1
  }
  return { added, removed }
}

export function toolVerb(name: string): string {
  if (name === 'edit_file') return 'Editing'
  if (name === 'write_file') return 'Creating'
  if (name === 'delete_file') return 'Deleting'
  if (name === 'read_file') return 'Reading'
  if (name === 'list_dir' || name === 'read_folder' || name === 'tree_view') return 'Exploring'
  if (SEARCH_TOOLS.has(name)) return 'Searching'
  if (name === 'run_command') return 'Running'
  if (name === 'run_tests') return 'Testing'
  if (name === 'run_build') return 'Building'
  if (name === 'run_linter') return 'Linting'
  if (name === 'spawn_swarm') return 'Swarm'
  if (name === 'git_commit') return 'Committing'
  if (name === 'fetch_url') return 'Fetching'
  return name.replace(/_/g, ' ')
}

export function toolActionLabel(name: string, path?: string): string {
  const verb = toolVerb(name)
  const file = path ? fileName(path) : ''
  return file ? `${verb} ${file}` : verb
}

export function lineDeltaFromTool(
  name: string,
  args?: Record<string, unknown>,
  result?: unknown,
): { added: number; removed: number } {
  if (result && typeof result === 'object') {
    const rec = result as Record<string, unknown>
    if (typeof rec.error === 'string' && rec.error) return { added: 0, removed: 0 }
    if (typeof rec.lines_added === 'number' || typeof rec.lines_removed === 'number') {
      return { added: Number(rec.lines_added) || 0, removed: Number(rec.lines_removed) || 0 }
    }
    if (typeof rec.diff === 'string') return countDiffLines(rec.diff)
  }
  if (name === 'edit_file') {
    return {
      added: lineCount(String(args?.new || '')),
      removed: lineCount(String(args?.old || '')),
    }
  }
  if (name === 'write_file') {
    return { added: lineCount(String(args?.content || '')), removed: 0 }
  }
  return { added: 0, removed: 0 }
}

function resultCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const rec = result as Record<string, unknown>
  if (typeof rec.error === 'string' && rec.error) return 0
  if (typeof rec.count === 'number') return rec.count
  if (Array.isArray(rec.entries)) return rec.entries.length
  if (Array.isArray(rec.files)) return rec.files.length
  if (Array.isArray(rec.matches)) return rec.matches.length
  if (Array.isArray(rec.results)) return rec.results.length
  return 0
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(', ')
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`
}

export function summarizeAgentActivity(input: {
  toolCalls?: ToolCall[]
  swarm?: SwarmState | null
  streaming?: boolean
}): AgentActivity {
  const calls = input.toolCalls || []
  const swarm = input.swarm
  const streaming = Boolean(input.streaming)

  const edited = new Set<string>()
  const created = new Set<string>()
  let explored = 0
  let searches = 0
  let commands = 0
  let added = 0
  let removed = 0

  for (const tc of calls) {
    const path = String(tc.args?.path || tc.args?.file || '')
    const delta = lineDeltaFromTool(tc.name, tc.args, tc.result)
    added += delta.added
    removed += delta.removed
    if (tc.name === 'write_file' && path) created.add(path)
    if (EDIT_TOOLS.has(tc.name) && path) edited.add(path)
    if (EXPLORE_TOOLS.has(tc.name)) {
      const n = resultCount(tc.result)
      explored += n > 0 ? n : 1
    }
    if (SEARCH_TOOLS.has(tc.name)) {
      searches += 1
      const n = resultCount(tc.result)
      explored += n > 0 ? n : 0
    }
    if (COMMAND_TOOLS.has(tc.name)) commands += 1
  }

  for (const worker of swarm?.workers || []) {
    added += worker.added || 0
    removed += worker.removed || 0
    if (worker.lastPath && (worker.lastTool === 'edit_file' || worker.lastTool === 'write_file' || worker.lastTool === 'delete_file')) {
      edited.add(worker.lastPath)
      if (worker.lastTool === 'write_file') created.add(worker.lastPath)
    }
    if (worker.lastTool && EXPLORE_TOOLS.has(worker.lastTool)) explored += 1
    if (worker.lastTool && SEARCH_TOOLS.has(worker.lastTool)) searches += 1
    if (worker.lastTool && COMMAND_TOOLS.has(worker.lastTool)) commands += 1
  }

  const runningCall = [...calls].reverse().find((tc) => tc.status === 'running' || tc.status === 'approval_needed')
  const runningWorker = (swarm?.workers || []).find((w) => w.status === 'running' || w.status === 'pending')
  const livePath = String(runningCall?.args?.path || runningCall?.args?.file || runningWorker?.lastPath || '')
  const liveTool = runningCall?.name && runningCall.name !== 'spawn_swarm'
    ? runningCall.name
    : runningWorker?.lastTool || runningCall?.name || ''

  let current = ''
  if (liveTool) current = toolActionLabel(liveTool, livePath)
  else if (swarm?.active) current = `Swarm · ${plural(swarm.workers.filter((w) => w.status === 'running' || w.status === 'pending').length || swarm.workers.length, 'agent')}`

  const summary = joinParts([
    explored > 0 ? `Explored ${plural(explored, 'file')}` : '',
    searches > 0 ? `${searches} ${searches === 1 ? 'search' : 'searches'}` : '',
    commands > 0 ? `ran ${plural(commands, 'command')}` : '',
  ])

  const editCount = edited.size
  const detail = joinParts([
    editCount > 0 ? `${created.size && created.size === editCount ? 'Creating' : 'Editing'} ${plural(editCount, 'file')}` : '',
    explored > 0 && editCount > 0 ? `explored ${plural(explored, 'file')}` : '',
  ])

  const hasWork = calls.length > 0 || Boolean(swarm?.workers.length) || added + removed + explored + searches + commands > 0

  let headline = 'Thinking'
  if (current) headline = current
  else if (streaming && swarm?.active) headline = 'Swarm'
  else if (streaming && detail) headline = detail.split(',')[0]
  else if (streaming && summary) headline = summary.split(',')[0]
  else if (!streaming) headline = 'Thought'

  if (streaming && swarm?.active && current && runningCall?.name === 'spawn_swarm') {
    headline = current.startsWith('Swarm') ? current : `Swarm · ${current}`
  }

  return {
    headline,
    summary,
    detail,
    current,
    added,
    removed,
    hasWork,
  }
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m}m ${rem}s` : `${m}m`
}

export function formatEta(ms: number): string {
  if (ms <= 0) return ''
  if (ms < 1500) return 'a few seconds left'
  return `~${formatDuration(ms)} left`
}

export function phaseLabel(phase: string): string {
  if (phase === 'writing') return 'Writing files'
  if (phase === 'reading') return 'Reading files'
  if (phase === 'running') return 'Running commands'
  if (phase === 'working') return 'Working'
  if (phase === 'starting') return 'Starting'
  return 'Thinking'
}

export function runProgressCaption(input: {
  iteration: number
  maxIterations: number
  toolsExecuted: number
  remainingTurns: number
  elapsedMs: number
  etaMs: number
}): string {
  const parts = [
    `Turn ${Math.max(input.iteration, 1)} of ${input.maxIterations}`,
    `${input.toolsExecuted} ${input.toolsExecuted === 1 ? 'tool' : 'tools'}`,
    `${input.remainingTurns} left`,
    formatDuration(input.elapsedMs),
  ]
  const eta = formatEta(input.etaMs)
  if (eta) parts.push(eta)
  return parts.join(' · ')
}
