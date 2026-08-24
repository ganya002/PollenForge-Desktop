import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { useStore, type SwarmWorker } from '../../store/store'
import { toolActionLabel } from '../../lib/agentActivity'

const MIN_H = 140
const MAX_H = 420
const HEIGHT_KEY = 'nx-swarm-height'
const TINTS = ['border-sky-500/70', 'border-emerald-500/70', 'border-amber-500/70']

function readHeight(): number {
  try {
    const n = parseInt(localStorage.getItem(HEIGHT_KEY) || '', 10)
    if (Number.isFinite(n)) return Math.min(MAX_H, Math.max(MIN_H, n))
  } catch {
    /* ignore */
  }
  return 208
}

function persistHeight(n: number) {
  try {
    localStorage.setItem(HEIGHT_KEY, String(n))
  } catch {
    /* ignore */
  }
}

function WorkerPane({ worker, tint }: { worker: SwarmWorker; tint: string }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const stick = useRef(true)
  const lastTop = useRef(0)

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const top = el.scrollTop
    if (top + 2 < lastTop.current) stick.current = false
    else stick.current = el.scrollHeight - top - el.clientHeight <= 48
    lastTop.current = top
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el || !stick.current) return
    el.scrollTop = el.scrollHeight
    lastTop.current = el.scrollTop
  }, [worker.content, worker.lastTool, worker.lastPath, worker.status])

  const action = worker.lastTool ? toolActionLabel(worker.lastTool, worker.lastPath) : ''
  const running = worker.status === 'running' || worker.status === 'pending'
  const failed = worker.status === 'error'

  return (
    <article className={`min-w-[11rem] min-h-0 flex flex-col overflow-hidden rounded-lg border border-border bg-surface-0 ${tint} border-l-2`}>
      <header className="h-8 shrink-0 px-2.5 flex items-center gap-2 border-b border-border bg-surface-1">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            failed ? 'bg-danger' : running ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
          }`}
        />
        <span className="text-[12px] font-medium text-text-primary truncate capitalize">{worker.role}</span>
        {action && (
          <span className="ml-auto max-w-[8.5rem] truncate text-[10px] text-text-muted">
            {action}
          </span>
        )}
      </header>
      <p className="shrink-0 px-2.5 py-1 text-[10px] leading-4 text-text-muted line-clamp-2 border-b border-border/70">
        {worker.task}
      </p>
      <div ref={scroller} onScroll={onScroll} className="flex-1 min-h-0 overflow-auto px-2.5 py-2">
        {worker.error ? (
          <p className="text-[12px] text-danger whitespace-pre-wrap">{worker.error}</p>
        ) : worker.content ? (
          <pre className="text-[12px] leading-relaxed text-text-secondary whitespace-pre-wrap break-words font-sans">
            {worker.content}
          </pre>
        ) : (
          <p className="text-[12px] text-text-muted">{running ? 'Working…' : 'No output'}</p>
        )}
      </div>
    </article>
  )
}

export default function SwarmBoard() {
  const swarm = useStore((s) => s.swarm)
  const clearSwarm = useStore((s) => s.clearSwarm)
  const [height, setHeight] = useState(readHeight)
  const [dragging, setDragging] = useState(false)
  const heightRef = useRef(height)
  const startRef = useRef({ y: 0, h: 0 })
  heightRef.current = height

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const cap = Math.min(MAX_H, Math.max(MIN_H, Math.floor(window.innerHeight * 0.46)))
      const next = Math.min(cap, Math.max(MIN_H, startRef.current.h + (startRef.current.y - e.clientY)))
      heightRef.current = next
      setHeight(next)
    }
    const onUp = () => {
      setDragging(false)
      persistHeight(heightRef.current)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'row-resize'
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

  const cap = Math.min(MAX_H, Math.max(MIN_H, Math.floor(window.innerHeight * 0.46)))
  const usedHeight = Math.min(height, cap)

  if (!swarm?.workers.length) return null

  const running = swarm.workers.filter((w) => w.status === 'running' || w.status === 'pending').length
  const cols = Math.min(3, Math.max(1, swarm.workers.length))
  const added = swarm.workers.reduce((n, w) => n + (w.added || 0), 0)
  const removed = swarm.workers.reduce((n, w) => n + (w.removed || 0), 0)

  return (
    <section
      className="shrink-0 flex flex-col min-h-0 border-t border-border bg-surface-1 relative"
      style={{ height: usedHeight }}
      aria-label="Swarm workers"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault()
          startRef.current = { y: e.clientY, h: heightRef.current }
          setDragging(true)
        }}
        className={`absolute -top-1 left-0 right-0 h-2 cursor-row-resize no-drag z-10 ${
          dragging ? 'bg-white/10' : 'hover:bg-white/5'
        }`}
        style={{ touchAction: 'none' }}
        aria-label="Resize swarm"
      />
      <header className="h-8 shrink-0 px-3 flex items-center gap-2 border-b border-border">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-text-muted">Swarm</span>
        {swarm.active && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
        {swarm.goal && (
          <span className="min-w-0 truncate text-[12px] text-text-secondary">{swarm.goal}</span>
        )}
        <span className="ml-auto text-[11px] text-text-muted shrink-0 inline-flex items-center gap-1.5">
          {added > 0 && <span className="text-emerald-400 tabular-nums">+{added}</span>}
          {removed > 0 && <span className="text-red-400 tabular-nums">-{removed}</span>}
          <span>
            {running > 0 ? `${running} running` : 'done'}
            {' · '}
            {swarm.workers.length}
          </span>
        </span>
        <button
          onClick={clearSwarm}
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2"
          title="Hide swarm"
          aria-label="Hide swarm"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div
        className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden p-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(11rem, 1fr))` }}
      >
        {swarm.workers.map((worker, i) => (
          <WorkerPane key={worker.id} worker={worker} tint={TINTS[i % TINTS.length]} />
        ))}
      </div>
    </section>
  )
}
