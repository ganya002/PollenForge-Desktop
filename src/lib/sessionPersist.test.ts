import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeSessionLists, sessionFilePayload, summaryFromSessionFile, userPreview } from './sessionPersist.ts'

test('userPreview uses the first user message', () => {
  assert.equal(userPreview([{ role: 'assistant', content: 'hi' }, { role: 'user', content: '  build this  ' }]), 'build this')
})

test('sessionFilePayload writes the Python session shape', () => {
  const payload = sessionFilePayload(
    [
      { id: '1', role: 'user', content: 'hello', timestamp: 1 },
      { id: '2', role: 'assistant', content: 'ok', timestamp: 2 },
    ],
    { name: 'Demo', directory: '/tmp/app' },
  )
  assert.equal(payload.meta.name, 'Demo')
  assert.equal(payload.meta.directory, '/tmp/app')
  assert.deepEqual(payload.messages, [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'ok' },
  ])
})

test('sessionFilePayload keeps assistant reasoning', () => {
  const payload = sessionFilePayload(
    [
      { id: '1', role: 'user', content: 'hi', timestamp: 1 },
      { id: '2', role: 'assistant', content: 'ok', reasoning: 'plan it', timestamp: 2 },
    ],
    { name: 'Think' },
  )
  assert.deepEqual(payload.messages[1], { role: 'assistant', content: 'ok', reasoning: 'plan it' })
})

test('summaryFromSessionFile reads meta from disk JSON', () => {
  const session = summaryFromSessionFile('abc', {
    messages: [{ role: 'user', content: 'ship it' }],
    meta: { name: 'Ship', updated_at: 1_777_000_000, directory: '/proj', pinned: true },
  })
  assert.equal(session.id, 'abc')
  assert.equal(session.name, 'Ship')
  assert.equal(session.preview, 'ship it')
  assert.equal(session.pinned, true)
  assert.equal(session.directory, '/proj')
})

test('mergeSessionLists keeps disk-only chats and prefers live metadata', () => {
  const merged = mergeSessionLists(
    [
      { id: 'old', name: 'Old', created: '', modified: '', message_count: 1, preview: 'disk' },
      { id: 'both', name: 'Disk', created: '', modified: '', message_count: 1, preview: 'disk' },
    ],
    [{ id: 'both', name: 'Live', created: '', modified: '', message_count: 4, preview: 'live' }],
  )
  const byId = Object.fromEntries(merged.map((s) => [s.id, s]))
  assert.equal(byId.old.preview, 'disk')
  assert.equal(byId.both.name, 'Live')
  assert.equal(byId.both.message_count, 4)
})
