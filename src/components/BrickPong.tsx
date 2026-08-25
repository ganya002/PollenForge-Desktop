import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  PADDLE_H,
  PADDLE_Y,
  POWER_META,
  brickColor,
  clampPaddle,
  createPong,
  dopamineBrickColor,
  konamiComplete,
  konamiProgress,
  launch,
  nextLevel,
  paddleWidth,
  stepPong,
  togglePause,
  type PongState,
} from '../lib/brickPong'

type Screen = 'menu' | 'game'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
  size: number
}

type Trail = { x: number; y: number }

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`
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

function draw(
  ctx: CanvasRenderingContext2D,
  state: PongState,
  dpr: number,
  opts: {
    dopamine: boolean
    t: number
    trail: Trail[]
    particles: Particle[]
    shake: number
    reducedMotion: boolean
    overlay: boolean
  },
) {
  const shakeX = opts.reducedMotion ? 0 : Math.sin(opts.t * 54) * opts.shake
  const shakeY = opts.reducedMotion ? 0 : Math.cos(opts.t * 47) * opts.shake
  ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr)
  ctx.clearRect(-12, -12, FIELD_W + 24, FIELD_H + 24)

  if (opts.dopamine) {
    const g = ctx.createLinearGradient(0, 0, FIELD_W, FIELD_H)
    g.addColorStop(0, hsl(opts.t * 80, 90, 8))
    g.addColorStop(0.5, hsl(opts.t * 80 + 120, 85, 12))
    g.addColorStop(1, hsl(opts.t * 80 + 240, 90, 7))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    ctx.save()
    ctx.globalAlpha = 0.35
    for (let i = 0; i < 18; i++) {
      const px = (Math.sin(opts.t * 0.7 + i * 1.7) * 0.5 + 0.5) * FIELD_W
      const py = (Math.cos(opts.t * 0.5 + i * 2.1) * 0.5 + 0.5) * FIELD_H
      ctx.fillStyle = hsl(opts.t * 180 + i * 40, 100, 70)
      ctx.beginPath()
      ctx.arc(px, py, 1.4 + (i % 3), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  } else {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim() || '#0e0e0e'
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
  }

  for (const brick of state.bricks) {
    ctx.fillStyle = opts.dopamine ? dopamineBrickColor(brick.row, opts.t) : brickColor(brick.row)
    ctx.globalAlpha = brick.hp > 1 ? 1 : 0.82
    if (opts.dopamine) {
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 12
    }
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 3)
    ctx.fill()
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1

  for (const drop of state.drops) {
    const meta = POWER_META[drop.kind]
    ctx.fillStyle = meta.color
    if (opts.dopamine) {
      ctx.shadowColor = meta.color
      ctx.shadowBlur = 14
    }
    roundRect(ctx, drop.x, drop.y, drop.w, drop.h, 4)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#0e0e0e'
    ctx.font = '700 10px Geist Sans, Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(meta.label, drop.x + drop.w / 2, drop.y + drop.h - 3)
  }

  if (opts.dopamine && !opts.reducedMotion) {
    for (let i = 0; i < opts.trail.length; i++) {
      const p = opts.trail[i]
      const a = ((i + 1) / opts.trail.length) * 0.45
      ctx.globalAlpha = a
      ctx.fillStyle = hsl(opts.t * 220 + i * 18, 100, 70)
      ctx.beginPath()
      ctx.arc(p.x, p.y, BALL_R * (0.4 + a), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    for (const p of opts.particles) {
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = hsl(p.hue, 100, 62)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  const width = paddleWidth(state)
  const paddlePulse = opts.dopamine && !opts.reducedMotion ? 1 + Math.sin(opts.t * 8) * 0.08 : 1
  const paddleW = width * paddlePulse
  const paddleX = state.paddleX - (paddleW - width) / 2
  ctx.fillStyle = opts.dopamine
    ? hsl(opts.t * 160, 100, 72)
    : getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#ececec'
  if (opts.dopamine) {
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 18
  }
  roundRect(ctx, paddleX, PADDLE_Y, paddleW, PADDLE_H, 4)
  ctx.fill()
  ctx.shadowBlur = 0

  for (const ball of state.balls) {
    if (opts.dopamine) {
      ctx.shadowColor = hsl(opts.t * 220, 100, 70)
      ctx.shadowBlur = 16
      ctx.fillStyle = '#fff'
    }
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, opts.dopamine ? BALL_R + 1.2 : BALL_R, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0

  if (opts.overlay && !state.paused) {
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
    ctx.fillText(opts.dopamine ? 'Esc pauses · juice is on' : 'catch falling upgrades · Esc pauses', FIELD_W / 2, FIELD_H / 2 + 16)
  }
}

function spawnBurst(particles: Particle[], x: number, y: number, extra: number) {
  const n = 10 + extra
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4
    const spd = 40 + Math.random() * 140
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 40,
      life: 1,
      hue: Math.random() * 360,
      size: 1.4 + Math.random() * 2.4,
    })
  }
}

export default function BrickPongHost() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState({ x: 56, y: 72 })
  const [focused, setFocused] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [ballCount, setBallCount] = useState(1)
  const [screen, setScreen] = useState<Screen>('menu')
  const [paused, setPaused] = useState(false)
  const [dopamine, setDopamine] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<PongState>(createPong(1))
  const keysRef = useRef({ left: false, right: false })
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const konamiRef = useRef<string[]>([])
  const screenRef = useRef<Screen>('menu')
  const dopamineRef = useRef(false)
  const focusedRef = useRef(false)
  const trailRef = useRef<Trail[]>([])
  const particlesRef = useRef<Particle[]>([])
  const shakeRef = useRef(0)
  const brickCountRef = useRef(0)
  const reducedMotion = useRef(false)

  screenRef.current = screen
  dopamineRef.current = dopamine
  focusedRef.current = focused

  const resetGame = useCallback((level = 1, keepScore = false) => {
    const next = createPong(level)
    if (keepScore) next.score = stateRef.current.score
    stateRef.current = next
    trailRef.current = []
    particlesRef.current = []
    shakeRef.current = 0
    brickCountRef.current = next.bricks.length
    setScore(next.score)
    setLives(next.lives)
    setLevel(next.level)
    setBallCount(next.balls.length)
    setPaused(false)
  }, [])

  const goMenu = useCallback(() => {
    resetGame(1)
    setScreen('menu')
    setMinimized(false)
    setPaused(false)
  }, [resetGame])

  const startGame = useCallback((juice: boolean) => {
    resetGame(1)
    dopamineRef.current = juice
    setDopamine(juice)
    setScreen('game')
    setFocused(true)
    setMinimized(false)
    setPaused(false)
  }, [resetGame])

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      if (!open || minimized || !focused || screenRef.current !== 'game') return
      if (stateRef.current.paused && e.key !== 'Escape') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
          e.preventDefault()
        }
        return
      }
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
          brickCountRef.current = s.bricks.length
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
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!focusedRef.current || screenRef.current !== 'game') return
      const s = stateRef.current
      if (s.phase !== 'playing' && s.phase !== 'ready') return
      e.preventDefault()
      e.stopPropagation()
      setPaused(togglePause(s))
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [open, minimized])

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
      const t = now / 1000
      const inGame = screenRef.current === 'game'
      if (inGame) {
        const move = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0)
        stepPong(stateRef.current, dt, move)
      }
      const s = stateRef.current
      setScore((n) => (n === s.score ? n : s.score))
      setLives((n) => (n === s.lives ? n : s.lives))
      setLevel((n) => (n === s.level ? n : s.level))
      setBallCount((n) => (n === s.balls.length ? n : s.balls.length))

      if (inGame && dopamineRef.current) {
        if (s.phase === 'playing' && !s.paused) {
          const trail = trailRef.current
          for (const ball of s.balls) trail.push({ x: ball.x, y: ball.y })
          if (trail.length > 18) trail.splice(0, trail.length - 18)
        }
        if (s.bricks.length < brickCountRef.current) {
          const hit = s.balls[0]
          spawnBurst(particlesRef.current, hit?.x ?? FIELD_W / 2, hit?.y ?? FIELD_H / 2, Math.min(18, s.combo * 3))
          shakeRef.current = Math.min(7, shakeRef.current + 3.5)
        }
        brickCountRef.current = s.bricks.length
        const parts = particlesRef.current
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.vy += 180 * dt
          p.life -= dt * 1.6
          if (p.life <= 0) parts.splice(i, 1)
        }
        shakeRef.current = Math.max(0, shakeRef.current - dt * 18)
      } else {
        trailRef.current = []
        particlesRef.current = []
        shakeRef.current = 0
      }

      draw(ctx, s, dpr, {
        dopamine: dopamineRef.current || screenRef.current === 'menu',
        t,
        trail: trailRef.current,
        particles: particlesRef.current,
        shake: shakeRef.current,
        reducedMotion: reducedMotion.current,
        overlay: inGame && !s.paused && s.phase !== 'playing',
      })
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
    if (screen !== 'game' || paused) return
    const s = stateRef.current
    if (s.phase === 'ready') launch(s)
    else if (s.phase === 'won') {
      nextLevel(s)
      setLevel(s.level)
      setLives(s.lives)
      brickCountRef.current = s.bricks.length
    } else if (s.phase === 'lost') resetGame(1)
  }

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (screen !== 'game' || paused) return
    const rect = e.currentTarget.getBoundingClientRect()
    const w = paddleWidth(stateRef.current)
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_W - w / 2
    stateRef.current.paddleX = clampPaddle(x, w)
  }

  if (!open) return null

  const juice = dopamine && screen === 'game'

  return (
    <div
      className="fixed z-[45] no-drag"
      style={{ left: pos.x, top: pos.y, width: minimized ? 220 : FIELD_W + 2 }}
      onMouseDown={() => setFocused(true)}
    >
      <div className={`rounded-xl border shadow-2xl overflow-hidden ${juice ? 'nx-dopamine-frame border-[#ff2bd6]' : focused ? 'border-accent' : 'border-border'} bg-surface-1`}>
        <div
          className={`h-8 flex items-center gap-2 px-2 cursor-grab active:cursor-grabbing select-none border-b ${juice ? 'bg-[#16081a] border-[#ff2bd655]' : 'bg-surface-2 border-border'}`}
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
                setDopamine(false)
                goMenu()
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
              aria-label="Main menu"
              className="w-3 h-3 rounded-full bg-[#6fbf73] hover:brightness-110"
              onClick={goMenu}
            />
          </div>
          <span className={`flex-1 text-[11px] truncate ${juice ? 'nx-dopamine-title font-semibold' : 'text-text-secondary'}`}>
            {screen === 'menu' ? 'Brick Pong' : juice ? 'DOPAMINE PONG' : 'Brick Pong'}
          </span>
          {screen === 'game' && (
            <span className={`text-[10px] tabular-nums shrink-0 ${juice ? 'nx-dopamine-title' : 'text-text-muted'}`}>
              {score} · L{level}{ballCount > 1 ? ` · ${ballCount}●` : ''} · {'●'.repeat(Math.max(0, lives))}
            </span>
          )}
        </div>
        {!minimized && (
          <div className={`relative ${juice ? 'nx-dopamine-scan' : ''}`}>
            <canvas
              ref={canvasRef}
              width={FIELD_W}
              height={FIELD_H}
              className="block w-full cursor-crosshair"
              style={{ height: FIELD_H }}
              onClick={onCanvasClick}
              onMouseMove={onCanvasMove}
            />
            {screen === 'menu' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 bg-black/55">
                <div className="text-center">
                  <div className="nx-dopamine-title text-[22px] font-black tracking-tight">BRICK PONG</div>
                  <div className="text-[11px] text-text-secondary mt-1">break bricks. catch upgrades. wait in style.</div>
                </div>
                <button
                  type="button"
                  className="w-full h-9 rounded-lg bg-surface-3 text-text-primary text-[13px] font-medium hover:bg-border"
                  onClick={() => startGame(false)}
                >
                  Play
                </button>
                <button
                  type="button"
                  className="nx-dopamine-btn w-full h-11 rounded-lg text-[13px]"
                  onClick={() => startGame(true)}
                >
                  Dopamine mode
                </button>
                <div className="text-[10px] text-text-muted">Esc pauses · green light for menu</div>
              </div>
            )}
            {screen === 'game' && paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-8 bg-black/70">
                <div className={`text-[18px] font-black ${juice ? 'nx-dopamine-title' : 'text-text-primary'}`}>PAUSED</div>
                <button
                  type="button"
                  className="w-full h-9 rounded-lg bg-surface-3 text-text-primary text-[13px] font-medium hover:bg-border"
                  onClick={() => {
                    stateRef.current.paused = false
                    setPaused(false)
                  }}
                >
                  Resume
                </button>
                <button
                  type="button"
                  className={juice
                    ? 'w-full h-9 rounded-lg bg-surface-3 text-text-primary text-[13px] font-medium hover:bg-border'
                    : 'nx-dopamine-btn w-full h-10 rounded-lg text-[12px]'}
                  onClick={() => setDopamine((on) => !on)}
                >
                  {juice ? 'Chill colors' : 'Dopamine mode'}
                </button>
                <button
                  type="button"
                  className="w-full h-9 rounded-lg text-[13px] text-text-secondary hover:text-text-primary"
                  onClick={goMenu}
                >
                  Main menu
                </button>
                <div className="text-[10px] text-text-muted">Esc to resume</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
