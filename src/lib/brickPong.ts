export const FIELD_W = 420
export const FIELD_H = 288
export const PADDLE_W = 68
export const PADDLE_H = 8
export const PADDLE_Y = FIELD_H - 18
export const BALL_R = 4.5
export const COLS = 10
export const BRICK_GAP = 3
export const DROP_W = 26
export const DROP_H = 14
export const MAX_BALLS = 6
export const DROP_CHANCE = 0.32
export const WIDE_SECONDS = 8

export type Phase = 'ready' | 'playing' | 'won' | 'lost'
export type PowerKind = 'extra' | 'multi' | 'wide' | 'life'

export type Brick = {
  x: number
  y: number
  w: number
  h: number
  hp: number
  row: number
}

export type Ball = {
  x: number
  y: number
  vx: number
  vy: number
}

export type PowerDrop = {
  x: number
  y: number
  w: number
  h: number
  kind: PowerKind
  vy: number
}

export type PongState = {
  paddleX: number
  balls: Ball[]
  bricks: Brick[]
  drops: PowerDrop[]
  lives: number
  score: number
  level: number
  phase: Phase
  combo: number
  paused: boolean
  wideT: number
}

export const POWER_META: Record<PowerKind, { label: string; color: string }> = {
  extra: { label: '+1', color: '#6fbf73' },
  multi: { label: 'x3', color: '#d4a05a' },
  wide: { label: 'W', color: '#5a9fd4' },
  life: { label: '+♥', color: '#c45c54' },
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

export function paddleWidth(state: PongState): number {
  return state.wideT > 0 ? PADDLE_W * 1.55 : PADDLE_W
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

function restBall(paddleX: number, width: number): Ball {
  return {
    x: paddleX + width / 2,
    y: PADDLE_Y - BALL_R - 1,
    vx: 0,
    vy: 0,
  }
}

export function createPong(level = 1): PongState {
  const paddleX = (FIELD_W - PADDLE_W) / 2
  return {
    paddleX,
    balls: [restBall(paddleX, PADDLE_W)],
    bricks: makeBricks(level),
    drops: [],
    lives: 3,
    score: 0,
    level,
    phase: 'ready',
    combo: 0,
    paused: false,
    wideT: 0,
  }
}

export function clampPaddle(x: number, width = PADDLE_W): number {
  return Math.max(6, Math.min(FIELD_W - width - 6, x))
}

export function ballSpeed(level: number): number {
  return 210 + level * 18
}

export function launch(state: PongState): void {
  if (state.phase !== 'ready' || state.paused) return
  const w = paddleWidth(state)
  const ball = state.balls[0] || restBall(state.paddleX, w)
  const dir = state.paddleX + w / 2 < FIELD_W / 2 ? 1 : -1
  const speed = ballSpeed(state.level)
  ball.vx = dir * speed * 0.55
  ball.vy = -speed
  ball.x = state.paddleX + w / 2
  ball.y = PADDLE_Y - BALL_R - 1
  state.balls = [ball]
  state.phase = 'playing'
}

function circleHitsRect(cx: number, cy: number, r: number, b: { x: number; y: number; w: number; h: number }): boolean {
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

export function pickPowerKind(rng: () => number = Math.random): PowerKind {
  const roll = rng()
  if (roll < 0.38) return 'extra'
  if (roll < 0.68) return 'multi'
  if (roll < 0.9) return 'wide'
  return 'life'
}

export function maybeSpawnDrop(state: PongState, brick: Brick, rng: () => number = Math.random): void {
  if (rng() >= DROP_CHANCE) return
  state.drops.push({
    x: brick.x + brick.w / 2 - DROP_W / 2,
    y: brick.y + brick.h,
    w: DROP_W,
    h: DROP_H,
    kind: pickPowerKind(rng),
    vy: 96 + state.level * 6,
  })
}

function spawnBall(state: PongState, angled: number): void {
  if (state.balls.length >= MAX_BALLS) return
  const speed = ballSpeed(state.level)
  const vx = angled * speed * 0.7
  const vy = -Math.abs(Math.sqrt(Math.max(speed * speed - vx * vx, speed * speed * 0.35)))
  const w = paddleWidth(state)
  state.balls.push({
    x: state.paddleX + w / 2,
    y: PADDLE_Y - BALL_R - 1,
    vx,
    vy,
  })
}

export function applyPower(state: PongState, kind: PowerKind): void {
  if (kind === 'life') {
    state.lives = Math.min(6, state.lives + 1)
    return
  }
  if (kind === 'wide') {
    state.wideT = WIDE_SECONDS
    state.paddleX = clampPaddle(state.paddleX, paddleWidth(state))
    return
  }
  if (state.phase === 'ready') launch(state)
  if (kind === 'extra') {
    spawnBall(state, state.balls.length % 2 === 0 ? 0.45 : -0.45)
    return
  }
  const shots = Math.min(3, MAX_BALLS - state.balls.length)
  const angles = [-0.75, 0, 0.75]
  for (let i = 0; i < shots; i++) spawnBall(state, angles[i] ?? (i - 1) * 0.5)
}

function stepBall(state: PongState, ball: Ball, dt: number, width: number): void {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  if (ball.x - BALL_R <= 0) {
    ball.x = BALL_R
    ball.vx = Math.abs(ball.vx)
  } else if (ball.x + BALL_R >= FIELD_W) {
    ball.x = FIELD_W - BALL_R
    ball.vx = -Math.abs(ball.vx)
  }
  if (ball.y - BALL_R <= 0) {
    ball.y = BALL_R
    ball.vy = Math.abs(ball.vy)
  }

  if (
    ball.vy > 0 &&
    ball.y + BALL_R >= PADDLE_Y &&
    ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
    ball.x >= state.paddleX - BALL_R &&
    ball.x <= state.paddleX + width + BALL_R
  ) {
    const speed = Math.hypot(ball.vx, ball.vy) * 1.02
    const bounced = bounceOffPaddle(ball.x, state.paddleX, width, speed)
    ball.vx = bounced.vx
    ball.vy = bounced.vy
    ball.y = PADDLE_Y - BALL_R - 0.5
    state.combo = 0
  }

  for (let i = state.bricks.length - 1; i >= 0; i--) {
    const brick = state.bricks[i]
    if (!circleHitsRect(ball.x, ball.y, BALL_R, brick)) continue
    const prevX = ball.x - ball.vx * dt
    const fromLeft = prevX < brick.x
    const fromRight = prevX > brick.x + brick.w
    if (fromLeft || fromRight) ball.vx *= -1
    else ball.vy *= -1
    brick.hp -= 1
    if (brick.hp <= 0) {
      maybeSpawnDrop(state, brick)
      state.bricks.splice(i, 1)
      state.combo += 1
      state.score += 10 * state.level * state.combo
    } else {
      state.score += 4
    }
    break
  }
}

function stepDrops(state: PongState, dt: number, width: number): void {
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const drop = state.drops[i]
    drop.y += drop.vy * dt
    const caught =
      drop.y + drop.h >= PADDLE_Y &&
      drop.y <= PADDLE_Y + PADDLE_H + 4 &&
      drop.x + drop.w >= state.paddleX &&
      drop.x <= state.paddleX + width
    if (caught) {
      applyPower(state, drop.kind)
      state.drops.splice(i, 1)
      continue
    }
    if (drop.y > FIELD_H) state.drops.splice(i, 1)
  }
}

export function stepPong(state: PongState, dt: number, move: number): void {
  if (state.paused) return
  if (state.phase !== 'playing' && state.phase !== 'ready') return

  if (state.wideT > 0) state.wideT = Math.max(0, state.wideT - dt)
  const width = paddleWidth(state)

  if (move) {
    state.paddleX = clampPaddle(state.paddleX + move * 460 * dt, width)
  } else {
    state.paddleX = clampPaddle(state.paddleX, width)
  }

  if (state.phase === 'ready') {
    const ball = state.balls[0] || restBall(state.paddleX, width)
    ball.x = state.paddleX + width / 2
    ball.y = PADDLE_Y - BALL_R - 1
    ball.vx = 0
    ball.vy = 0
    state.balls = [ball]
    stepDrops(state, dt, width)
    return
  }

  for (const ball of state.balls) stepBall(state, ball, dt, width)

  state.balls = state.balls.filter((ball) => ball.y - BALL_R <= FIELD_H)

  stepDrops(state, dt, width)

  if (state.bricks.length === 0) {
    state.phase = 'won'
    state.drops = []
    return
  }

  if (state.balls.length === 0) {
    state.lives -= 1
    state.combo = 0
    state.wideT = 0
    if (state.lives <= 0) {
      state.phase = 'lost'
      state.drops = []
      return
    }
    state.phase = 'ready'
    state.balls = [restBall(state.paddleX, paddleWidth(state))]
  }
}

export function nextLevel(state: PongState): void {
  const level = state.level + 1
  const next = createPong(level)
  next.score = state.score
  next.lives = Math.min(6, state.lives + 1)
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
