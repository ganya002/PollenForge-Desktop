export type GuestLike = {
  src?: string
  getURL?: () => string
  loadURL?: (url: string) => void
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
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

export function navigateGuest(guest: GuestLike | null | undefined, url: string): boolean {
  if (!guest || !url) return false
  try {
    if (typeof guest.loadURL === 'function') {
      guest.loadURL(url)
      return true
    }
  } catch {
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
    guest?.[method]?.()
  } catch {
    /* ignore */
  }
}
