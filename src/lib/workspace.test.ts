import assert from 'node:assert/strict'
import { test } from 'node:test'
import { folderName, joinWorkspace, mapListEntries, resolveChatDirectory } from './workspacePaths.ts'

test('resolveChatDirectory prefers the chat folder over pending and default', () => {
  assert.equal(
    resolveChatDirectory({
      sessionDirectory: 'C:\\proj\\a',
      pendingWorkspace: 'C:\\proj\\b',
      defaultDirectory: 'C:\\proj\\c',
    }),
    'C:\\proj\\a',
  )
  assert.equal(
    resolveChatDirectory({
      sessionDirectory: '',
      pendingWorkspace: 'C:\\proj\\b',
      defaultDirectory: 'C:\\proj\\c',
    }),
    'C:\\proj\\b',
  )
  assert.equal(
    resolveChatDirectory({
      sessionDirectory: '',
      pendingWorkspace: null,
      defaultDirectory: 'C:\\proj\\c',
    }),
    'C:\\proj\\c',
  )
  assert.equal(resolveChatDirectory({}), null)
})

test('joinWorkspace keeps Windows separators', () => {
  assert.equal(joinWorkspace('C:\\Users\\me\\app', 'plan.md'), 'C:\\Users\\me\\app\\plan.md')
  assert.equal(joinWorkspace('/Users/me/app/', 'plan.md'), '/Users/me/app/plan.md')
})

test('folderName uses the last segment', () => {
  assert.equal(folderName('C:\\Users\\me\\PollenForge-Desktop'), 'PollenForge-Desktop')
  assert.equal(folderName('/tmp/demo/'), 'demo')
})

test('mapListEntries maps backend list_dir rows', () => {
  const rows = mapListEntries({
    entries: [
      { name: 'plan.md', path: '/tmp/demo/plan.md', is_dir: false, size: 12, modified: 1 },
      { name: 'src', path: '/tmp/demo/src', is_dir: true, size: null, modified: 2 },
    ],
  })
  assert.equal(rows[0].name, 'plan.md')
  assert.equal(rows[0].isDirectory, false)
  assert.equal(rows[1].isDirectory, true)
})
