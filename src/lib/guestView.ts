export type GuestLike = {
  src?: string
  getURL?: () => string
  loadURL?: (url: string) => void | Promise<void>
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
}

export function isBenignGuestViewError(message: string): boolean {
  const text = message || ''
  // Only swallow webview-specific aborts — plain ERR_ABORTED from fetch/XHR is not benign
  const isAborted = /ERR_ABORTED/i.test(text) && /guest|webview/i.test(text)
  return (
    /GUEST_VIEW_MANAGER/i.test(text) ||
    isAborted ||
    /WebView must be attached/i.test(text) ||
    /webview is destroyed/i.test(text)
  )
}

export function urlsLooselyEqual(a: string, b: string): boolean {
  const norm = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase()
  return Boolean(a) && norm(a) === norm(b)
}

export function guestCurrentUrl(guest: GuestLike | null | undefined): string {
  if (!guest) return ''
  try {
    const url = guest.getURL?.()
    if (typeof url === 'string' && url) return url
  } catch {
    /* webview is not dom-ready */
  }
  return typeof guest.src === 'string' ? guest.src : ''
}

function swallowGuestError(err: unknown): void {
  const text = err instanceof Error ? err.message : String(err || '')
  if (isBenignGuestViewError(text)) return
}

export function navigateGuest(guest: GuestLike | null | undefined, url: string, force = false): boolean {
  if (!guest || !url) return false
  if (!force && urlsLooselyEqual(guestCurrentUrl(guest), url)) return true
  try {
    if (typeof guest.loadURL === 'function') {
      const result = guest.loadURL(url)
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>).catch(swallowGuestError)
      }
      return true
    }
  } catch (err) {
    swallowGuestError(err)
    /* not attached yet — fall through to src */
  }
  try {
    guest.src = url
    return true
  } catch {
    return false
  }
}

export function callGuest(guest: GuestLike | null | undefined, method: 'goBack' | 'goForward' | 'reload'): void {
  try {
    const result = guest?.[method]?.() as unknown
    if (result && typeof (result as Promise<void>).then === 'function') {
      void (result as Promise<void>).catch(swallowGuestError)
    }
  } catch (err) {
    swallowGuestError(err)
  }
}
