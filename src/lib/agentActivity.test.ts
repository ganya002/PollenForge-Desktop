import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ToolCall } from '../store/store.ts'
import {
  countDiffLines,
  lineDeltaFromTool,
  summarizeAgentActivity,
  toolActionLabel,
} from './agentActivity.ts'

function call(partial: Partial<ToolCall> & Pick<ToolCall, 'name'>): ToolCall {
  return {
    id: partial.id || partial.name,
    args: partial.args || {},
    status: partial.status || 'done',
    result: partial.result,
    name: partial.name,
  }
}

test('toolActionLabel uses Creating/Editing plus the file name', () => {
  assert.equal(toolActionLabel('edit_file', 'src/components/Chat/ChatArea.tsx'), 'Editing ChatArea.tsx')
  assert.equal(toolActionLabel('write_file', 'src/App.tsx'), 'Creating App.tsx')
})

test('counts + and - from edit args and diffs', () => {
  assert.deepEqual(
    lineDeltaFromTool('edit_file', { old: 'a\nb', new: 'a\nb\nc\nd' }),
    { added: 4, removed: 2 },
  )
  assert.deepEqual(
    countDiffLines('--- a\n+++ b\n@@\n-old\n+new\n+more\n'),
    { added: 2, removed: 1 },
  )
})

test('live headline follows the file being edited', () => {
  const activity = summarizeAgentActivity({
    streaming: true,
    toolCalls: [
      call({ name: 'read_file', args: { path: 'a.ts' }, result: { content: 'x' } }),
      call({
        name: 'edit_file',
        status: 'running',
        args: { path: 'src/ChatArea.tsx', old: 'foo', new: 'foo\nbar\nbaz' },
      }),
    ],
  })
  assert.equal(activity.headline, 'Editing ChatArea.tsx')
  assert.match(activity.summary, /Explored 1 file/)
  assert.match(activity.detail, /Editing 1 file/)
  assert.equal(activity.added, 3)
  assert.equal(activity.removed, 1)
})

test('summary mixes explores, searches, and commands', () => {
  const activity = summarizeAgentActivity({
    streaming: true,
    toolCalls: [
      call({ name: 'list_dir', result: { count: 12, entries: new Array(12).fill({}) } }),
      call({ name: 'search_code', result: { count: 8 } }),
      call({ name: 'search_files', result: { count: 2 } }),
      call({ name: 'run_command', args: { command: 'npm test' } }),
    ],
  })
  assert.equal(activity.summary, 'Explored 22 files, 2 searches, ran 1 command')
})

test('swarm workers feed the live headline and line counts', () => {
  const activity = summarizeAgentActivity({
    streaming: true,
    toolCalls: [call({ name: 'spawn_swarm', status: 'running', args: { goal: 'split ui' } })],
    swarm: {
      goal: 'split ui',
      active: true,
      workers: [
        {
          id: 's0',
          role: 'implementer',
          task: 'write ui',
          content: '',
          status: 'running',
          lastTool: 'edit_file',
          lastPath: 'src/components/Chat/SwarmBoard.tsx',
          added: 40,
          removed: 6,
        },
        {
          id: 's1',
          role: 'reviewer',
          task: 'review',
          content: '',
          status: 'running',
          lastTool: 'read_file',
          lastPath: 'src/App.tsx',
        },
      ],
    },
  })
  assert.equal(activity.headline, 'Swarm · Editing SwarmBoard.tsx')
  assert.equal(activity.added, 40)
  assert.equal(activity.removed, 6)
  assert.match(activity.detail, /Editing 1 file/)
})
