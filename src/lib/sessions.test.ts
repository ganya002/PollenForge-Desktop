import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionTimestampMs } from './sessions.ts'

test('sessionTimestampMs treats unix seconds as dates after 2001', () => {
  const ms = sessionTimestampMs({ updated_at: 1_777_000_000, modified: '' })
  assert.ok(ms > 1e12)
  assert.equal(new Date(ms).getUTCFullYear(), 2026)
})
