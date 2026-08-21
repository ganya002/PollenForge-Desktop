export interface BrowserTarget {
  label: string
  url: string
}

function joinPath(root: string, rel: string): string {
  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const rest = rel.replace(/\\/g, '/').replace(/^\/+/, '')
  return `${base}/${rest}`
}

export function pathToFileUrl(filePath: string): string {
  let p = filePath.replace(/\\/g, '/')
  if (/^[A-Za-z]:/.test(p)) p = `/${p}`
  if (!p.startsWith('/')) p = `/${p}`
  return `file://${p}`
}

export function isSafeBrowserUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:'
  } catch {
    return false
  }
}

export function resolveBrowserUrl(input: string, workspace?: string | null): string {
  const text = (input || '').trim().replace(/[.,;:]+$/, '')
  if (!text) return ''
  if (/^(https?:|file:)/i.test(text)) {
    return isSafeBrowserUrl(text) ? text : ''
  }
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(text)) {
    const url = `http://${text}`
    return isSafeBrowserUrl(url) ? url : ''
  }
  if (/\.html?$/i.test(text)) {
    if (/^[A-Za-z]:[\\/]/.test(text) || text.startsWith('/')) return pathToFileUrl(text)
    if (workspace) return pathToFileUrl(joinPath(workspace, text))
  }
  return ''
}

function labelFor(url: string): string {
  if (url.startsWith('file:')) {
    const name = decodeURIComponent(url.split('/').pop() || url)
    return `Open ${name}`
  }
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '') || url
}

export function extractBrowserTargets(text: string, workspace?: string | null): BrowserTarget[] {
  const found: BrowserTarget[] = []
  const seen = new Set<string>()
  const add = (raw: string) => {
    const url = resolveBrowserUrl(raw, workspace)
    if (!url || seen.has(url)) return
    seen.add(url)
    found.push({ label: labelFor(url), url })
  }

  const src = text || ''
  for (const match of src.matchAll(/https?:\/\/[^\s)\]>'"]+/gi)) add(match[0])
  for (const match of src.matchAll(/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/[^\s)\]>'"]*)?/gi)) {
    add(match[0])
  }
  for (const match of src.matchAll(/\b(?:[\w./\\-]+\/)*index\.html?\b|\b[\w.-]+\.html?\b/gi)) {
    add(match[0])
  }
  return found
}

export function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path.split(/[?#]/)[0] || '')
}
