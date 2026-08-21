import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeSession, sessionTimestampMs } from './sessionMeta.ts'

test('normalizeSession keeps the per-chat project folder', () => {
  const session = normalizeSession({
    id: 'abc',
    name: 'Demo',
    created: '2026-01-01',
    modified: '2026-01-02',
    message_count: 2,
    directory: 'C:\\proj\\app',
  })
  assert.equal(session.directory, 'C:\\proj\\app')
})

test('sessionTimestampMs treats unix seconds as dates after 2001', () => {
  const ms = sessionTimestampMs({ updated_at: 1_777_000_000, modified: '' })
  assert.ok(ms > 1e12)
  assert.equal(new Date(ms).getUTCFullYear(), 2026)
})
