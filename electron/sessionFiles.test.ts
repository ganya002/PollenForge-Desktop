import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { importLegacySessions, listSessionSummaries, saveSessionFile } from './sessionFiles.ts'

test('saveSessionFile writes JSON that listSessionSummaries can read', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexum-sessions-'))
  saveSessionFile(root, 'abc123', {
    messages: [{ role: 'user', content: 'keep this chat' }],
    meta: { name: 'Kept', updated_at: 1_777_000_000, directory: '/proj' },
  })
  const listed = listSessionSummaries(root)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, 'abc123')
  assert.equal(listed[0].preview, 'keep this chat')
  assert.equal(listed[0].directory, '/proj')
})

test('importLegacySessions copies missing chats into userData', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexum-home-'))
  const home = join(root, 'home')
  const dest = join(root, 'userdata')
  const legacy = join(home, '.local', 'share', 'nexum', 'sessions')
  mkdirSync(legacy, { recursive: true })
  writeFileSync(join(legacy, 'old.json'), JSON.stringify({
    messages: [{ role: 'user', content: 'from before the update' }],
    meta: { name: 'Legacy' },
  }))
  const copied = importLegacySessions(dest, home)
  assert.equal(copied, 1)
  assert.match(readFileSync(join(dest, 'sessions', 'old.json'), 'utf8'), /from before the update/)
  assert.equal(importLegacySessions(dest, home), 0)
})
