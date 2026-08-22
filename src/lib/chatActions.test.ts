import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compactMessages,
  htmlUrlFromTool,
  messagesThroughUser,
  projectPathFromDrop,
  pushBrowserHistory,
  sessionMatches,
  sortSessions,
} from './chatActions.ts'
import type { Message, Session } from '../store/store.ts'

const msg = (id: string, role: Message['role'] = 'user'): Message => ({
  id,
  role,
  content: id,
  timestamp: 1,
})

test('compactMessages keeps a note plus the tail', () => {
  const messages = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => msg(id))
  const next = compactMessages(messages, 3)
  assert.equal(next[0].id, 'compact-note')
  assert.deepEqual(next.slice(1).map((m) => m.id), ['f', 'g', 'h'])
})

test('messagesThroughUser drops the edited user and everything after', () => {
  const messages = [msg('u1'), msg('a1', 'assistant'), msg('u2'), msg('a2', 'assistant')]
  assert.deepEqual(messagesThroughUser(messages, 'u2').map((m) => m.id), ['u1', 'a1'])
})

test('sortSessions puts pinned chats first', () => {
  const sessions = [
    { id: 'a', name: 'old', created: '', modified: '', message_count: 1, updated_at: 20 },
    { id: 'b', name: 'pin', created: '', modified: '', message_count: 1, updated_at: 10, pinned: true },
  ] as Session[]
  assert.deepEqual(sortSessions(sessions).map((s) => s.id), ['b', 'a'])
})

test('sessionMatches title and preview', () => {
  const s = { id: '1', name: 'New Chat', preview: 'fix pong collisions', directory: 'C:\\pong', created: '', modified: '', message_count: 2 } as Session
  assert.equal(sessionMatches(s, 'pong', 'New Chat'), true)
  assert.equal(sessionMatches(s, 'zebra', 'New Chat'), false)
})

test('htmlUrlFromTool only opens html writes', () => {
  assert.equal(
    htmlUrlFromTool('write_file', { path: 'index.html' }, 'C:\\Users\\me\\pong'),
    'file:///C:/Users/me/pong/index.html',
  )
  assert.equal(htmlUrlFromTool('write_file', { path: 'main.py' }, 'C:\\proj'), '')
  assert.equal(htmlUrlFromTool('run_command', { path: 'index.html' }, 'C:\\proj'), '')
})

test('pushBrowserHistory keeps newest unique urls', () => {
  assert.deepEqual(pushBrowserHistory('about:blank', ['http://localhost:3000']), ['http://localhost:3000'])
  assert.deepEqual(
    pushBrowserHistory('http://localhost:5500/', ['http://localhost:3000', 'http://localhost:5500/']),
    ['http://localhost:5500/', 'http://localhost:3000'],
  )
})

test('projectPathFromDrop uses a folder, or the parent of a file', () => {
  assert.equal(projectPathFromDrop([{ path: 'C:\\pong', name: 'pong' }]), 'C:\\pong')
  assert.equal(projectPathFromDrop([{ path: 'C:\\pong\\index.html', name: 'index.html' }]), 'C:\\pong')
  assert.equal(projectPathFromDrop([]), '')
})
