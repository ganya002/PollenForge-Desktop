import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { easeOut } from '../../lib/motion'
import { useStore } from '../../store/store'
import { currentWorkspace } from '../../lib/workspace'
import { isSafeBrowserUrl, resolveBrowserUrl } from '../../lib/browserTargets'
import { pushBrowserHistory } from '../../lib/chatActions'
import { callGuest, guestCurrentUrl, navigateGuest, type GuestLike } from '../../lib/guestView'

type GuestView = HTMLElement & GuestLike

const MIN_W = 280
const MAX_W = 720
const DEFAULT_W = 380
const WIDTH_KEY = 'nx-browser-width'
const HISTORY_KEY = 'nx-browser-history'

function readWidth(): number {
  try {
    const n = parseInt(localStorage.getItem(WIDTH_KEY) || '', 10)
    if (Number.isFinite(n)) return Math.min(MAX_W, Math.max(MIN_W, n))
  } catch {
    /* ignore */
  }
  return DEFAULT_W
}

function readHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((item) => typeof item === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

function persistHistory(urls: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(urls.slice(0, 8)))
  } catch {
    /* ignore */
  }
}

function navigateInput(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  const fromHelper = resolveBrowserUrl(text, currentWorkspace())
  if (fromHelper) return fromHelper
  if (/^https?:\/\//i.test(text) && isSafeBrowserUrl(text)) return text
  if (/^[\w.-]+(\.\w+)+(:\d+)?(\/.*)?$/i.test(text)) {
    const url = `https://${text}`
    return isSafeBrowserUrl(url) ? url : ''
  }
  return ''
}

export default function BrowserPanel() {
  const open = useStore((s) => s.browserOpen)
  const url = useStore((s) => s.browserUrl)
  const browserTick = useStore((s) => s.browserTick)
  const fullscreen = useStore((s) => s.browserFullscreen)
  const setUrl = useStore((s) => s.setBrowserUrl)
  const setFullscreen = useStore((s) => s.setBrowserFullscreen)
  const toggleBrowser = useStore((s) => s.toggleBrowser)
  const [width, setWidth] = useState(readWidth)
  const [draft, setDraft] = useState(url)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState(readHistory)
  const [mounted, setMounted] = useState(open)
  const [ready, setReady] = useState(false)
  const widthRef = useRef(width)
  const urlRef = useRef(url)
  const viewRef = useRef<GuestView | null>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  urlRef.current = url

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    setDraft(url)
    if (!url || url === 'about:blank') return
    setHistory((prev) => {
      const next = pushBrowserHistory(url, prev)
      persistHistory(next)
      return next
    })
  }, [url])

  useEffect(() => {
    if (!mounted) return
    const guest = viewRef.current
    if (!guest) return
    const onReady = () => {
      setReady(true)
      const next = urlRef.current
      if (next && next !== 'about:blank') navigateGuest(guest, next)
    }
    const onNav = () => {
      const next = guestCurrentUrl(guest)
      if (next && next !== 'about:blank') {
        setDraft(next)
        setUrl(next)
      }
    }
    const start = () => setLoading(true)
    const stop = () => setLoading(false)
    guest.addEventListener('dom-ready', onReady)
    guest.addEventListener('did-navigate', onNav)
    guest.addEventListener('did-navigate-in-page', onNav)
    guest.addEventListener('did-start-loading', start)
    guest.addEventListener('did-stop-loading', stop)
    guest.addEventListener('did-finish-load', stop)
    return () => {
      guest.removeEventListener('dom-ready', onReady)
      guest.removeEventListener('did-navigate', onNav)
      guest.removeEventListener('did-navigate-in-page', onNav)
      guest.removeEventListener('did-start-loading', start)
      guest.removeEventListener('did-stop-loading', stop)
      guest.removeEventListener('did-finish-load', stop)
    }
  }, [mounted, setUrl])

  useEffect(() => {
    if (!ready || !url) return
    navigateGuest(viewRef.current, url)
  }, [url, ready, browserTick])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, setFullscreen])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX))
      widthRef.current = next
      if (asideRef.current) asideRef.current.style.width = `${next}px`
    }
    const onUp = () => {
      setDragging(false)
      const finalWidth = widthRef.current
      setWidth(finalWidth)
      try {
        localStorage.setItem(WIDTH_KEY, String(finalWidth))
      } catch {
        /* ignore */
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging])

  const go = useCallback(
    (value: string) => {
      const next = navigateInput(value)
      if (next) setUrl(next)
    },
    [setUrl],
  )

  if (!mounted) return null

  return (
    <motion.aside
      ref={asideRef}
      initial={false}
      animate={open ? { opacity: 1, x: 0 } : { opacity: 0, x: 12 }}
      transition={{ duration: 0.22, ease: easeOut }}
      style={{
        ...(fullscreen && open ? undefined : { width }),
        display: open ? undefined : 'none',
      }}
      className={
        fullscreen
          ? 'fixed inset-0 z-[80] bg-surface-0 flex flex-col'
          : 'h-full shrink-0 border-l border-border bg-surface-1 flex flex-col relative'
      }
    >
      {!fullscreen && (
        <div
          onPointerDown={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            setDragging(true)
          }}
          className={`absolute top-0 left-0 w-1.5 h-full cursor-col-resize no-drag z-10 ${
            dragging ? 'bg-white/15' : 'hover:bg-white/10'
          }`}
          style={{ touchAction: 'none' }}
          aria-label="Resize browser"
        >
          <div className="absolute inset-y-0 left-0 w-px bg-border" />
        </div>
      )}

      <div className="h-10 shrink-0 flex items-center gap-1 px-1.5 border-b border-border bg-surface-1">
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 8h3v3M11 6H8V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M8 3h3v3M6 11H3V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          onClick={() => callGuest(viewRef.current, 'goBack')}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2"
          title="Back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.5 3.5L5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => callGuest(viewRef.current, 'goForward')}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2"
          title="Forward"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.5 3.5L9 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => callGuest(viewRef.current, 'reload')}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2"
          title="Reload"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M11 7a4 4 0 11-1.2-2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M11 3v2.5H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <form
          className="flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault()
            go(draft)
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="localhost:3000 or index.html"
            className="h-7 w-full px-2 rounded-md bg-surface-2 border border-border text-[12px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </form>
        {history.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const next = e.target.value
              if (next) setUrl(next)
            }}
            className="h-7 max-w-[7.5rem] px-1 rounded-md bg-surface-2 border border-border text-[11px] text-text-secondary"
            title="Recent pages"
            aria-label="Recent pages"
          >
            <option value="">Recent</option>
            {history.map((item) => (
              <option key={item} value={item}>
                {item.replace(/^https?:\/\//, '').replace(/^file:\/\//, '')}
              </option>
            ))}
          </select>
        )}
        {!fullscreen && (
          <button
            onClick={toggleBrowser}
            className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2"
            title="Hide browser"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 4l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-surface-0 relative">
        {createElement('webview', {
          ref: viewRef,
          src: url || 'about:blank',
          partition: 'persist:nexum-preview',
          allowpopups: 'true',
          style: { width: '100%', height: '100%', background: '#111' },
        })}
        {!url && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-surface-0">
            <div>
              <div className="text-[13px] text-text-secondary mb-1">Built-in browser</div>
              <div className="text-[12px] text-text-muted max-w-[16rem]">
                Open localhost, paste a URL, or click index.html in chat or Files.
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
