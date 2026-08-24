import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bundleVenvPython, seedPythonCandidates, venvPythonPath } from './backendPython.ts'

test('venvPythonPath uses Scripts on Windows and bin elsewhere', () => {
  assert.equal(venvPythonPath('/data/backend-venv', 'win32').replace(/\\/g, '/'), '/data/backend-venv/Scripts/python.exe')
  assert.equal(venvPythonPath('/data/backend-venv', 'darwin'), '/data/backend-venv/bin/python')
})

test('packaged apps never treat the app-bundle .venv as a Python seed', () => {
  const backendRoot = '/Applications/Nexum.app/Contents/Resources/backend'
  const seeds = seedPythonCandidates({
    isPackaged: true,
    backendRoot,
    extraBinDirs: ['/opt/homebrew/bin'],
    platform: 'darwin',
    env: {},
  })
  assert.equal(seeds.includes(bundleVenvPython(backendRoot, 'darwin')), false)
  assert.equal(seeds.includes('/opt/homebrew/bin/python3'), true)
})

test('unpackaged apps can seed from the project .venv', () => {
  const backendRoot = '/Users/me/PollenForge-Desktop/backend'
  const seeds = seedPythonCandidates({
    isPackaged: false,
    backendRoot,
    extraBinDirs: [],
    platform: 'darwin',
    env: { PYTHON3: '/custom/python3' },
  })
  assert.equal(seeds[0], bundleVenvPython(backendRoot, 'darwin'))
  assert.equal(seeds.includes('/custom/python3'), true)
})
