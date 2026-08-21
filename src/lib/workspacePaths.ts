export function folderName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] || path
}

export function joinWorkspace(dir: string, file: string): string {
  const trimmed = dir.replace(/[\\/]+$/, '')
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return `${trimmed}${sep}${file}`
}

export function resolveChatDirectory(opts: {
  sessionDirectory?: string | null
  pendingWorkspace?: string | null
  defaultDirectory?: string | null
}): string | null {
  for (const value of [opts.sessionDirectory, opts.pendingWorkspace, opts.defaultDirectory]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export function mapListEntries(data: { entries?: Record<string, unknown>[] }) {
  if (!Array.isArray(data.entries)) return []
  return data.entries.map((item) => ({
    name: String(item.name || ''),
    path: String(item.path || item.name || ''),
    isDirectory: Boolean(item.is_dir ?? item.isDirectory),
    size: (item.size as number | null) ?? null,
    modified: (item.modified as number) ?? 0,
    git_status: item.git_status as 'modified' | 'new' | 'deleted' | 'untracked' | undefined,
  }))
}
