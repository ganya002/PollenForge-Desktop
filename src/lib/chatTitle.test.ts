import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displaySessionTitle, relativeTime, titleFromPrompt } from './chatTitle.ts'

test('titleFromPrompt skips commands and token dumps', () => {
  assert.equal(titleFromPrompt('New Chat'), '')
  assert.equal(titleFromPrompt('/cost'), '')
  assert.equal(titleFromPrompt('Token usage: 0 total. Model gpt-5.6-sol on pollinations.'), '')
  assert.equal(titleFromPrompt('/help'), '')
  assert.equal(titleFromPrompt('/caveman'), '')
  assert.equal(titleFromPrompt('/goal fix the pong paddle'), 'fix the pong paddle')
  assert.equal(titleFromPrompt('/image a red bicycle'), 'a red bicycle')
  assert.equal(titleFromPrompt('/web latest rust'), 'latest rust')
  assert.equal(titleFromPrompt('make a pong game'), 'make a pong game')
})

test('displaySessionTitle prefers a real prompt over New Chat', () => {
  assert.equal(
    displaySessionTitle({ name: 'New Chat', preview: 'build a pong game in html' }),
    'build a pong game in html',
  )
  assert.equal(
    displaySessionTitle({
      name: 'Token usage: 0 total. Model gpt-5.6-sol on pollinations.',
      preview: 'fix collisions in pong',
    }),
    'fix collisions in pong',
  )
  assert.equal(displaySessionTitle({ name: 'test', preview: 'ignored' }), 'test')
})

test('relativeTime uses compact labels', () => {
  const now = Date.parse('2026-08-22T12:00:00Z')
  assert.equal(relativeTime(now - 30_000, now), 'now')
  assert.equal(relativeTime(now - 12 * 60_000, now), '12m')
  assert.equal(relativeTime(now - 3 * 3600_000, now), '3h')
  assert.equal(relativeTime(Date.parse('2026-08-21T12:00:00Z'), now), 'Yesterday')
})
