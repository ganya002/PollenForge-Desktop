const FILE_MUTATING_TOOLS = new Set([
  'write_file',
  'edit_file',
  'run_command',
  'git_clone',
  'git_checkout',
  'run_formatter',
  'spawn_swarm',
])

const WATCH_SKIP = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.venv',
  'venv',
  'dist-electron',
  '.next',
  'dist',
])

export function shouldRefreshFileTree(tool: string, result?: unknown): boolean {
  if (!FILE_MUTATING_TOOLS.has(tool)) return false
  if (result && typeof result === 'object' && result !== null && 'error' in result) {
    const err = (result as { error?: unknown }).error
    if (err != null && err !== '') return false
  }
  return true
}

export function ignoreWatchPath(relativePath?: string | null): boolean {
  if (!relativePath) return false
  return relativePath.split(/[\\/]/).some((part) => WATCH_SKIP.has(part))
}
