import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BALL_R,
  DROP_CHANCE,
  FIELD_W,
  PADDLE_W,
  PADDLE_Y,
  applyPower,
  bounceOffPaddle,
  clampPaddle,
  createPong,
  dopamineBrickColor,
  konamiComplete,
  konamiProgress,
  launch,
  maybeSpawnDrop,
  paddleWidth,
  stepPong,
  togglePause,
} from './brickPong.ts'

test('paddle stays on the field', () => {
  assert.equal(clampPaddle(-40), 6)
  assert.ok(clampPaddle(999) <= FIELD_W - PADDLE_W - 6)
})

test('launch leaves the ready state', () => {
  const g = createPong(1)
  assert.equal(g.phase, 'ready')
  launch(g)
  assert.equal(g.phase, 'playing')
  assert.ok(g.balls[0].vy < 0)
})

test('ball bouncing on the paddle edges angles outward', () => {
  const left = bounceOffPaddle(10, 10, 68, 200)
  const right = bounceOffPaddle(78, 10, 68, 200)
  assert.ok(left.vx < 0)
  assert.ok(right.vx > 0)
  assert.ok(left.vy < 0 && right.vy < 0)
})

test('missing the paddle costs a life', () => {
  const g = createPong(1)
  launch(g)
  g.balls[0].x = 40
  g.balls[0].y = 400
  g.balls[0].vy = 80
  g.paddleX = 300
  stepPong(g, 0.016, 0)
  assert.equal(g.lives, 2)
  assert.equal(g.phase, 'ready')
})

test('breaking every brick wins the level', () => {
  const g = createPong(1)
  launch(g)
  g.bricks = []
  stepPong(g, 0.016, 0)
  assert.equal(g.phase, 'won')
})

test('konami sequence completes', () => {
  let keys: string[] = []
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    keys = konamiProgress(keys, k)
  }
  assert.equal(konamiComplete(keys), true)
})

test('wrong konami key resets', () => {
  let keys = konamiProgress([], 'ArrowUp')
  keys = konamiProgress(keys, 'x')
  assert.deepEqual(keys, [])
})

test('ball radius is used for ready rest height', () => {
  const g = createPong()
  assert.ok(g.balls[0].y < 288 - BALL_R)
})

test('paused game does not move the ball', () => {
  const g = createPong()
  launch(g)
  const y = g.balls[0].y
  g.paused = true
  stepPong(g, 0.05, 0)
  assert.equal(g.balls[0].y, y)
})

test('togglePause flips ready and playing games', () => {
  const g = createPong()
  assert.equal(g.paused, false)
  assert.equal(togglePause(g), true)
  launch(g)
  assert.equal(g.phase, 'ready')
  g.paused = false
  launch(g)
  assert.equal(g.phase, 'playing')
  assert.equal(togglePause(g), true)
  assert.equal(togglePause(g), false)
})

test('dopamine brick color is a cycling hsl', () => {
  const a = dopamineBrickColor(0, 0)
  const b = dopamineBrickColor(0, 1)
  assert.ok(a.startsWith('hsl('))
  assert.notEqual(a, b)
})

test('catching +1 extra ball adds a second ball', () => {
  const g = createPong()
  launch(g)
  assert.equal(g.balls.length, 1)
  applyPower(g, 'extra')
  assert.equal(g.balls.length, 2)
})

test('multi shot is a one-time burst of extra balls', () => {
  const g = createPong()
  launch(g)
  applyPower(g, 'multi')
  assert.ok(g.balls.length >= 3)
})

test('losing one extra ball does not cost a life', () => {
  const g = createPong()
  launch(g)
  applyPower(g, 'extra')
  g.balls[1].y = 400
  g.balls[1].vy = 80
  stepPong(g, 0.016, 0)
  assert.equal(g.lives, 3)
  assert.equal(g.phase, 'playing')
  assert.equal(g.balls.length, 1)
})

test('breaking a brick can drop a catchable upgrade', () => {
  const g = createPong()
  const brick = g.bricks[0]
  maybeSpawnDrop(g, brick, () => 0)
  assert.equal(g.drops.length, 1)
  assert.equal(g.drops[0].kind, 'extra')
})

test('skipping the drop roll leaves no upgrade', () => {
  const g = createPong()
  maybeSpawnDrop(g, g.bricks[0], () => 0.99)
  assert.equal(g.drops.length, 0)
  assert.ok(0.99 >= DROP_CHANCE)
})

test('catching a falling upgrade on the paddle applies it', () => {
  const g = createPong()
  launch(g)
  g.drops.push({
    x: g.paddleX + 8,
    y: PADDLE_Y - 4,
    w: 26,
    h: 14,
    kind: 'life',
    vy: 80,
  })
  stepPong(g, 0.02, 0)
  assert.equal(g.drops.length, 0)
  assert.equal(g.lives, 4)
})

test('wide upgrade widens the paddle', () => {
  const g = createPong()
  applyPower(g, 'wide')
  assert.ok(paddleWidth(g) > PADDLE_W)
})
