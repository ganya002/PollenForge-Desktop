export const FIELD_W = 420
export const FIELD_H = 288
export const PADDLE_W = 68
export const PADDLE_H = 8
export const PADDLE_Y = FIELD_H - 18
export const BALL_R = 4.5
export const COLS = 10
export const BRICK_GAP = 3

export type Phase = 'ready' | 'playing' | 'won' | 'lost'

export type Brick = {
  x: number
  y: number
  w: number
  h: number
  hp: number
  row: number
}

export type PongState = {
  paddleX: number
  ballX: number
  ballY: number
  vx: number
  vy: number
  bricks: Brick[]
  lives: number
  score: number
  level: number
  phase: Phase
  combo: number
  paused: boolean
}

const ROW_COLORS = 6

export function brickColor(row: number): string {
  const colors = ['#c45c54', '#d4a05a', '#6fbf73', '#5a9fd4', '#8b7ec8', '#c47aa8']
  return colors[row % colors.length]
}

export function dopamineBrickColor(row: number, t: number): string {
  const hue = (row * 47 + t * 140) % 360
  return `hsl(${hue}, 100%, 62%)`
}

export function makeBricks(level: number): Brick[] {
  const rows = Math.min(ROW_COLORS, 3 + level)
  const inset = 10
  const top = 28
  const brickH = 14
  const brickW = (FIELD_W - inset * 2 - BRICK_GAP * (COLS - 1)) / COLS
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        x: inset + col * (brickW + BRICK_GAP),
        y: top + row * (brickH + BRICK_GAP),
        w: brickW,
        h: brickH,
        hp: row < 2 && level > 1 ? 2 : 1,
        row,
      })
    }
  }
  return bricks
}

export function createPong(level = 1): PongState {
  const paddleX = (FIELD_W - PADDLE_W) / 2
  return {
    paddleX,
    ballX: paddleX + PADDLE_W / 2,
    ballY: PADDLE_Y - BALL_R - 1,
    vx: 0,
    vy: 0,
    bricks: makeBricks(level),
    lives: 3,
    score: 0,
    level,
    phase: 'ready',
    combo: 0,
    paused: false,
  }
}

export function clampPaddle(x: number): number {
  return Math.max(6, Math.min(FIELD_W - PADDLE_W - 6, x))
}

export function launch(state: PongState): void {
  if (state.phase !== 'ready' || state.paused) return
  const dir = state.paddleX + PADDLE_W / 2 < FIELD_W / 2 ? 1 : -1
  const speed = 210 + state.level * 18
  state.vx = dir * speed * 0.55
  state.vy = -speed
  state.phase = 'playing'
}

function circleHitsRect(cx: number, cy: number, r: number, b: Brick): boolean {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w))
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h))
  const dx = cx - nx
  const dy = cy - ny
  return dx * dx + dy * dy <= r * r
}

export function bounceOffPaddle(ballX: number, paddleX: number, paddleW: number, speed: number): { vx: number; vy: number } {
  const t = (ballX - paddleX) / paddleW
  const angled = (Math.max(0, Math.min(1, t)) - 0.5) * 2
  const vx = angled * speed * 0.85
  const vy = -Math.abs(Math.sqrt(Math.max(speed * speed - vx * vx, speed * speed * 0.25)))
  return { vx, vy }
}

export function togglePause(state: PongState): boolean {
  if (state.phase !== 'playing' && state.phase !== 'ready') return state.paused
  state.paused = !state.paused
  return state.paused
}

export function stepPong(state: PongState, dt: number, move: number): void {
  if (state.paused) return
  if (state.phase !== 'playing' && state.phase !== 'ready') return

  if (move) {
    state.paddleX = clampPaddle(state.paddleX + move * 460 * dt)
  }

  if (state.phase === 'ready') {
    state.ballX = state.paddleX + PADDLE_W / 2
    state.ballY = PADDLE_Y - BALL_R - 1
    return
  }

  state.ballX += state.vx * dt
  state.ballY += state.vy * dt

  if (state.ballX - BALL_R <= 0) {
    state.ballX = BALL_R
    state.vx = Math.abs(state.vx)
  } else if (state.ballX + BALL_R >= FIELD_W) {
    state.ballX = FIELD_W - BALL_R
    state.vx = -Math.abs(state.vx)
  }
  if (state.ballY - BALL_R <= 0) {
    state.ballY = BALL_R
    state.vy = Math.abs(state.vy)
  }

  if (
    state.vy > 0 &&
    state.ballY + BALL_R >= PADDLE_Y &&
    state.ballY + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
    state.ballX >= state.paddleX - BALL_R &&
    state.ballX <= state.paddleX + PADDLE_W + BALL_R
  ) {
    const speed = Math.hypot(state.vx, state.vy) * 1.02
    const bounced = bounceOffPaddle(state.ballX, state.paddleX, PADDLE_W, speed)
    state.vx = bounced.vx
    state.vy = bounced.vy
    state.ballY = PADDLE_Y - BALL_R - 0.5
    state.combo = 0
  }

  for (let i = state.bricks.length - 1; i >= 0; i--) {
    const brick = state.bricks[i]
    if (!circleHitsRect(state.ballX, state.ballY, BALL_R, brick)) continue
    const prevX = state.ballX - state.vx * dt
    const fromLeft = prevX < brick.x
    const fromRight = prevX > brick.x + brick.w
    if (fromLeft || fromRight) state.vx *= -1
    else state.vy *= -1
    brick.hp -= 1
    if (brick.hp <= 0) {
      state.bricks.splice(i, 1)
      state.combo += 1
      state.score += 10 * state.level * state.combo
    } else {
      state.score += 4
    }
    break
  }

  if (state.bricks.length === 0) {
    state.phase = 'won'
    return
  }

  if (state.ballY - BALL_R > FIELD_H) {
    state.lives -= 1
    state.combo = 0
    if (state.lives <= 0) {
      state.phase = 'lost'
      return
    }
    state.phase = 'ready'
    state.vx = 0
    state.vy = 0
    state.ballX = state.paddleX + PADDLE_W / 2
    state.ballY = PADDLE_Y - BALL_R - 1
  }
}

export function nextLevel(state: PongState): void {
  const level = state.level + 1
  const next = createPong(level)
  next.score = state.score
  next.lives = Math.min(5, state.lives + 1)
  Object.assign(state, next)
}

export function konamiProgress(soFar: string[], key: string): string[] {
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
  const next = [...soFar, key]
  const slice = next.slice(-seq.length)
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] !== seq[i]) return slice[i] === seq[0] ? [slice[i]] : []
  }
  return slice
}

export function konamiComplete(keys: string[]): boolean {
  return keys.join(',') === 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a'
}

export function openBrickPong(): void {
  document.dispatchEvent(new CustomEvent('open-brick-pong'))
}
