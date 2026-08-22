import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isAskBlockedTool,
  isHtmlWriteTool,
  messageMatchesFind,
  normalizeAgentMode,
  normalizeTheme,
  pushPromptHistory,
  toolPath,
} from './qol.ts'

test('normalizeTheme falls back to dark', () => {
  assert.equal(normalizeTheme('light'), 'light')
  assert.equal(normalizeTheme('nope'), 'dark')
})

test('ask mode blocks writes and shell', () => {
  assert.equal(normalizeAgentMode('ask'), 'ask')
  assert.equal(isAskBlockedTool('write_file'), true)
  assert.equal(isAskBlockedTool('read_file'), false)
})

test('prompt history newest unique first', () => {
  assert.deepEqual(pushPromptHistory(['old', 'keep'], 'keep'), ['keep', 'old'])
  assert.deepEqual(pushPromptHistory(['a'], '  '), ['a'])
})

test('find and html write helpers', () => {
  assert.equal(messageMatchesFind('Fix pong collisions', 'pong'), true)
  assert.equal(messageMatchesFind('hello', 'zebra'), false)
  assert.equal(toolPath({ path: 'src/app.ts' }), 'src/app.ts')
  assert.equal(isHtmlWriteTool('write_file', { path: 'index.html' }), true)
  assert.equal(isHtmlWriteTool('read_file', { path: 'index.html' }), false)
})
