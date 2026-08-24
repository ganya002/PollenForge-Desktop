// T1: every renderer -> backend request must carry the auth token that the
// Electron main process generated and handed to the backend via env.
// Websites can't read our IPC bridge, so drive-by fetch() from random pages
// now fails with 401.

let cachedToken: string | null = null

export function cachedBackendToken(): string {
  return cachedToken || ''
}

export async function backendToken(): Promise<string> {
  if (cachedToken) return cachedToken
  try {
    const res = await window.api?.backend?.token?.()
    if (res?.token) cachedToken = res.token
  } catch {
    /* browser preview / unit tests: no bridge */
  }
  return cachedToken || ''
}

/** fetch() wrapper that attaches X-Nexum-Token (+JSON content-type for bodies). */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await backendToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('X-Nexum-Token', token)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}
