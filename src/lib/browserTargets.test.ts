import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  extractBrowserTargets,
  isSafeBrowserUrl,
  pathToFileUrl,
  resolveBrowserUrl,
} from './browserTargets.ts'

test('resolveBrowserUrl keeps http localhost and file html', () => {
  assert.equal(resolveBrowserUrl('http://localhost:5500/'), 'http://localhost:5500/')
  assert.equal(resolveBrowserUrl('localhost:3000'), 'http://localhost:3000')
  assert.equal(resolveBrowserUrl('127.0.0.1:8080/play'), 'http://127.0.0.1:8080/play')
  assert.equal(
    resolveBrowserUrl('index.html', 'C:\\Users\\me\\pong'),
    'file:///C:/Users/me/pong/index.html',
  )
})

test('pathToFileUrl normalizes windows paths', () => {
  assert.equal(pathToFileUrl('C:\\proj\\index.html'), 'file:///C:/proj/index.html')
  assert.equal(pathToFileUrl('/tmp/game.html'), 'file:///tmp/game.html')
})

test('isSafeBrowserUrl blocks javascript and allows local files', () => {
  assert.equal(isSafeBrowserUrl('javascript:alert(1)'), false)
  assert.equal(isSafeBrowserUrl('http://localhost:80'), true)
  assert.equal(isSafeBrowserUrl('file:///C:/proj/index.html'), true)
  assert.equal(isSafeBrowserUrl('https://example.com'), true)
})

test('extractBrowserTargets finds localhost and html mentions', () => {
  const hits = extractBrowserTargets(
    'Test the game here: http://localhost:5173 and open index.html',
    'C:\\Users\\me\\pong',
  )
  assert.deepEqual(
    hits.map((h) => h.url),
    ['http://localhost:5173', 'file:///C:/Users/me/pong/index.html'],
  )
})
