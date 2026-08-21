import { useStore } from '../store/store'
import { isHtmlPath, resolveBrowserUrl } from './browserTargets'

function basename(path: string) {
  return path.replace(/\\/g, '/').split('/').pop() || path
}

export async function openWorkspaceFile(
  path: string,
  opts?: { root?: string | null; force?: boolean },
) {
  const name = basename(path)
  if (!opts?.force && isHtmlPath(name)) {
    const url = resolveBrowserUrl(path, opts?.root || null)
    if (url) {
      useStore.getState().openInBrowser(url)
      return
    }
  }
  const store = useStore.getState()
  const existing = store.openFiles.find((f) => f.path === path)
  if (!opts?.force && existing && existing.content && !existing.error) {
    store.setActiveFile(path)
    return
  }
  store.upsertOpenFile({ path, name, content: existing?.content || '' })
  try {
    const body: Record<string, string> = { path }
    if (opts?.root) body.root = opts.root
    const res = await fetch('http://127.0.0.1:8765/files/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data?.error) {
      store.upsertOpenFile({ path, name, content: '', error: String(data.error) })
      return
    }
    store.upsertOpenFile({
      path,
      name,
      content: typeof data?.content === 'string' ? data.content : '',
      truncated: !!data?.truncated,
    })
  } catch (err) {
    store.upsertOpenFile({
      path,
      name,
      content: '',
      error: err instanceof Error ? err.message : 'Could not read file',
    })
  }
}

export function addFileToChat(path: string) {
  document.dispatchEvent(new CustomEvent('send-message', { detail: `@${path} ` }))
}
