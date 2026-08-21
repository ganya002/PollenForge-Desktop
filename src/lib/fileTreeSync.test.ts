import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ignoreWatchPath, shouldRefreshFileTree } from './fileTreeSync.ts'

test('refresh after file-mutating tools succeed', () => {
  assert.equal(shouldRefreshFileTree('write_file', { success: true, path: 'index.html' }), true)
  assert.equal(shouldRefreshFileTree('edit_file', { success: true }), true)
  assert.equal(shouldRefreshFileTree('run_command', { exit_code: 0 }), true)
})

test('do not refresh failed or read-only tools', () => {
  assert.equal(shouldRefreshFileTree('write_file', { error: 'denied' }), false)
  assert.equal(shouldRefreshFileTree('read_file', { content: 'hi' }), false)
  assert.equal(shouldRefreshFileTree('list_dir', { entries: [] }), false)
})

test('ignore noisy watch paths', () => {
  assert.equal(ignoreWatchPath('node_modules\\foo.js'), true)
  assert.equal(ignoreWatchPath('.git/HEAD'), true)
  assert.equal(ignoreWatchPath('__pycache__/x.pyc'), true)
  assert.equal(ignoreWatchPath('index.html'), false)
  assert.equal(ignoreWatchPath('src/style.css'), false)
})
