import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notesForDisplay } from './releaseNotes.ts'

test('notesForDisplay strips download/setup template and keeps the summary', () => {
  const body = `# Nexum 1.0.1

Desktop AI coding assistant for **macOS** and **Windows**.

## Download

### Windows 1.0.1

- Installer

## Setup

Install Python.
`
  const out = notesForDisplay(body)
  assert.equal(out, 'Desktop AI coding assistant for **macOS** and **Windows**.')
  assert.doesNotMatch(out, /Download/)
})

test('notesForDisplay falls back when body is only boilerplate', () => {
  assert.equal(
    notesForDisplay('## Download\n- file.exe'),
    'Desktop AI coding assistant for macOS and Windows.',
  )
})
