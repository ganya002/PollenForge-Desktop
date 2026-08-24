import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BALL_R,
  FIELD_W,
  PADDLE_W,
  bounceOffPaddle,
  clampPaddle,
  createPong,
  konamiComplete,
  konamiProgress,
  launch,
  stepPong,
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
  assert.ok(g.vy < 0)
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
  g.ballX = 40
  g.ballY = 400
  g.vy = 80
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
  assert.ok(g.ballY < 288 - BALL_R)
})
