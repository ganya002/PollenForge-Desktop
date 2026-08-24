import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  brickColor,
  createPong,
  konamiComplete,
  konamiProgress,
  launch,
  nextLevel,
  stepPong,
  type PongState,
} from '../lib/brickPong'

function draw(ctx: CanvasRenderingContext2D, state: PongState, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, FIELD_W, FIELD_H)
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim() || '#0e0e0e'
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)

  for (const brick of state.bricks) {
    ctx.fillStyle = brickColor(brick.row)
    ctx.globalAlpha = brick.hp > 1 ? 1 : 0.82
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 3)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#ececec'
  roundRect(ctx, state.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H, 4)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(state.ballX, state.ballY, BALL_R, 0, Math.PI * 2)
  ctx.fill()

  if (state.phase !== 'playing') {
    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    ctx.fillStyle = '#ececec'
    ctx.textAlign = 'center'
    ctx.font = '600 15px Geist Sans, Inter, sans-serif'
    const title =
      state.phase === 'ready' ? 'Click or space to serve' :
      state.phase === 'won' ? 'Clear — click for next round' :
      'Out of lives — click to restart'
    ctx.fillText(title, FIELD_W / 2, FIELD_H / 2 - 6)
    ctx.font = '12px Geist Sans, Inter, sans-serif'
    ctx.fillStyle = '#a3a3a3'
    ctx.fillText('← → or mouse to move', FIELD_W / 2, FIELD_H / 2 + 16)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export default function BrickPongHost() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState({ x: 56, y: 72 })
  const [focused, setFocused] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<PongState>(createPong(1))
  const keysRef = useRef({ left: false, right: false })
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const konamiRef = useRef<string[]>([])

  const resetGame = useCallback((level = 1, keepScore = false) => {
    const next = createPong(level)
    if (keepScore) next.score = stateRef.current.score
    stateRef.current = next
    setScore(next.score)
    setLives(next.lives)
    setLevel(next.level)
  }, [])

  useEffect(() => {
    const openIt = () => {
      setOpen(true)
      setMinimized(false)
      setFocused(true)
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.type === 'keydown' && !typing) {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
        konamiRef.current = konamiProgress(konamiRef.current, key)
        if (konamiComplete(konamiRef.current)) {
          konamiRef.current = []
          openIt()
        }
      }
      if (!open || minimized || !focused) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = e.type === 'keydown'
        e.preventDefault()
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = e.type === 'keydown'
        e.preventDefault()
      }
      if (e.type === 'keydown' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'ready') launch(s)
        else if (s.phase === 'won') {
          nextLevel(s)
          setLevel(s.level)
          setLives(s.lives)
        } else if (s.phase === 'lost') resetGame(1)
      }
    }
    document.addEventListener('open-brick-pong', openIt)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      document.removeEventListener('open-brick-pong', openIt)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [open, minimized, focused, resetGame])

  useEffect(() => {
    if (!open || minimized) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = FIELD_W * dpr
    canvas.height = FIELD_H * dpr
    let last = performance.now()
    let frame = 0
    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const move = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0)
      stepPong(stateRef.current, dt, move)
      const s = stateRef.current
      setScore((n) => (n === s.score ? n : s.score))
      setLives((n) => (n === s.lives ? n : s.lives))
      setLevel((n) => (n === s.level ? n : s.level))
      draw(ctx, s, dpr)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [open, minimized])

  const onTitlePointer = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onTitleMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const maxX = Math.max(8, window.innerWidth - 80)
    const maxY = Math.max(8, window.innerHeight - 40)
    setPos({
      x: Math.max(8, Math.min(maxX, e.clientX - dragRef.current.dx)),
      y: Math.max(8, Math.min(maxY, e.clientY - dragRef.current.dy)),
    })
  }

  const onCanvasClick = () => {
    setFocused(true)
    const s = stateRef.current
    if (s.phase === 'ready') launch(s)
    else if (s.phase === 'won') {
      nextLevel(s)
      setLevel(s.level)
      setLives(s.lives)
    } else if (s.phase === 'lost') resetGame(1)
  }

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_W - PADDLE_W / 2
    stateRef.current.paddleX = Math.max(6, Math.min(FIELD_W - PADDLE_W - 6, x))
  }

  if (!open) return null

  return (
    <div
      className="fixed z-[45] no-drag"
      style={{ left: pos.x, top: pos.y, width: minimized ? 220 : FIELD_W + 2 }}
      onMouseDown={() => setFocused(true)}
    >
      <div className={`rounded-xl border shadow-2xl overflow-hidden ${focused ? 'border-accent' : 'border-border'} bg-surface-1`}>
        <div
          className="h-8 flex items-center gap-2 px-2 cursor-grab active:cursor-grabbing select-none bg-surface-2 border-b border-border"
          onPointerDown={onTitlePointer}
          onPointerMove={onTitleMove}
          onPointerUp={() => { dragRef.current = null }}
          onDoubleClick={() => setMinimized((m) => !m)}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Close"
              className="w-3 h-3 rounded-full bg-[#c45c54] hover:brightness-110"
              onClick={() => {
                setOpen(false)
                setMinimized(false)
                resetGame(1)
              }}
            />
            <button
              type="button"
              aria-label={minimized ? 'Restore' : 'Minimize'}
              className="w-3 h-3 rounded-full bg-[#d4a05a] hover:brightness-110"
              onClick={() => setMinimized((m) => !m)}
            />
            <button
              type="button"
              aria-label="New game"
              className="w-3 h-3 rounded-full bg-[#6fbf73] hover:brightness-110"
              onClick={() => {
                setMinimized(false)
                resetGame(1)
              }}
            />
          </div>
          <span className="flex-1 text-[11px] text-text-secondary truncate">Brick Pong</span>
          <span className="text-[10px] tabular-nums text-text-muted shrink-0">
            {score} · L{level} · {'●'.repeat(Math.max(0, lives))}
          </span>
        </div>
        {!minimized && (
          <canvas
            ref={canvasRef}
            width={FIELD_W}
            height={FIELD_H}
            className="block w-full cursor-crosshair"
            style={{ height: FIELD_H }}
            onClick={onCanvasClick}
            onMouseMove={onCanvasMove}
          />
        )}
      </div>
    </div>
  )
}
