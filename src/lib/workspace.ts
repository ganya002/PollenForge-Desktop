import { useStore } from '../store/store'
import { persistConfig } from './appConfig'
import { openWorkspaceFile } from './workspaceFiles'
import {
  joinWorkspace,
  mapListEntries,
  resolveChatDirectory,
} from './workspacePaths'

export { folderName, joinWorkspace, mapListEntries, resolveChatDirectory } from './workspacePaths'

const API = 'http://127.0.0.1:8765'

const PLAN_STUB = `# Plan

Waiting for the next prompt. Ask for a plan in chat with Plan mode on.
`

export function currentWorkspace(): string | null {
  const s = useStore.getState()
  const session = s.sessions.find((x) => x.id === s.currentSessionId)
  return resolveChatDirectory({
    sessionDirectory: session?.directory,
    pendingWorkspace: s.pendingWorkspace,
    defaultDirectory: s.config.default_directory,
  })
}

export async function pickProjectFolder(): Promise<string | null> {
  const result = await window.api?.app?.pickDirectory?.()
  if (!result?.ok || !result.path) return null
  return result.path
}

export async function setChatDirectory(path: string, opts?: { asDefault?: boolean }): Promise<void> {
  const store = useStore.getState()
  store.setPendingWorkspace(path)
  const sid = store.currentSessionId
  if (sid) {
    try {
      await fetch(`${API}/sessions/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: path }),
      })
      store.setSessions(store.sessions.map((s) => (s.id === sid ? { ...s, directory: path } : s)))
    } catch {
      /* ignore */
    }
  }
  if (opts?.asDefault) {
    const next = { ...store.config, default_directory: path }
    store.setConfig(next)
    persistConfig(next)
  }
  await refreshFileTree(path)
}

export async function pickAndSetProjectFolder(opts?: { asDefault?: boolean }): Promise<string | null> {
  const path = await pickProjectFolder()
  if (!path) return null
  await setChatDirectory(path, opts)
  return path
}

export function persistDefaultFromCurrent(): void {
  const dir = currentWorkspace()
  if (!dir) return
  const store = useStore.getState()
  const next = { ...store.config, default_directory: dir }
  store.setConfig(next)
  persistConfig(next)
}

export function clearDefaultDirectory(): void {
  const store = useStore.getState()
  const next = { ...store.config, default_directory: '' }
  store.setConfig(next)
  persistConfig(next)
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export async function refreshFileTree(root?: string | null): Promise<void> {
  const dir = root ?? currentWorkspace()
  const store = useStore.getState()
  if (!dir) {
    store.setFileTree([])
    return
  }
  try {
    const res = await fetch(`${API}/files/list?path=.&root=${encodeURIComponent(dir)}`)
    const data = await res.json()
    store.setFileTree(mapListEntries(data))
  } catch {
    store.setFileTree([])
  }
}

export function scheduleFileTreeRefresh(root?: string | null, delay = 250): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refreshFileTree(root)
  }, delay)
}

export async function deleteWorkspaceFile(
  relativePath: string,
  root?: string | null,
): Promise<boolean> {
  const dir = root ?? currentWorkspace()
  if (!dir) return false
  const res = await fetch(`${API}/files/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relativePath, root: dir }),
  })
  const data = await res.json()
  if (data?.error) throw new Error(String(data.error))
  scheduleFileTreeRefresh(dir)
  return true
}

export async function renameWorkspaceFile(
  from: string,
  to: string,
  root?: string | null,
): Promise<boolean> {
  const dir = root ?? currentWorkspace()
  if (!dir || !from.trim() || !to.trim() || from === to) return false
  const res = await fetch(`${API}/files/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: from, root: dir }),
  })
  const data = await res.json()
  if (data?.error) throw new Error(String(data.error))
  const content = typeof data?.content === 'string' ? data.content : ''
  await writeWorkspaceFile(to, content, dir)
  await deleteWorkspaceFile(from, dir)
  return true
}

export async function writeWorkspaceFile(
  relativePath: string,
  content: string,
  root?: string | null,
): Promise<string | null> {
  const dir = root ?? currentWorkspace()
  if (!dir) return null
  const res = await fetch(`${API}/files/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relativePath, content, root: dir }),
  })
  const data = await res.json()
  if (data?.error) throw new Error(String(data.error))
  scheduleFileTreeRefresh(dir)
  return typeof data?.path === 'string' ? data.path : joinWorkspace(dir, relativePath)
}

export async function ensurePlanFile(): Promise<string | null> {
  let dir = currentWorkspace()
  if (!dir) dir = await pickAndSetProjectFolder()
  if (!dir) return null
  const path = joinWorkspace(dir, 'plan.md')
  try {
    const existing = await fetch(`${API}/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'plan.md', root: dir }),
    })
    const data = await existing.json()
    if (!data?.error && typeof data?.content === 'string' && data.content.trim()) {
      await openWorkspaceFile(path, { root: dir, force: true })
      return path
    }
  } catch {
    /* write stub */
  }
  const written = await writeWorkspaceFile('plan.md', PLAN_STUB, dir)
  await openWorkspaceFile(written || path, { root: dir, force: true })
  return written || path
}

export async function savePlanMarkdown(content: string): Promise<void> {
  const dir = currentWorkspace()
  if (!dir || !content.trim()) return
  const written = await writeWorkspaceFile('plan.md', `${content.trim()}\n`, dir)
  const path = written || joinWorkspace(dir, 'plan.md')
  await openWorkspaceFile(path, { root: dir, force: true })
  await refreshFileTree(dir)
}
