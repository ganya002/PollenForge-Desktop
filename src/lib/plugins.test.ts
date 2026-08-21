import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyActivePlugins, handlePluginSlash, installPlugin, setPluginActive } from './plugins.ts'
import type { Config } from '../store/store.ts'

const base: Config = {
  providers: {},
  enabled_providers: ['pollinations'],
  installed_plugins: [],
  active_plugins: [],
  model: 'x',
  provider: 'pollinations',
  temperature: 0.4,
  max_tokens: 1,
  auto_approve: true,
}

test('applyActivePlugins prepends installed active plugin prompts', () => {
  const cfg = setPluginActive(installPlugin(base, 'caveman'), 'caveman', true)
  const out = applyActivePlugins('fix the login', cfg)
  assert.match(out, /CAVEMAN MODE/)
  assert.match(out, /User request:\nfix the login/)
})

test('/caveman consumes the slash and activates the plugin', () => {
  const { result, config } = handlePluginSlash('/caveman', base)
  assert.equal(result.kind, 'consumed')
  assert.ok(config.active_plugins.includes('caveman'))
  assert.ok(config.installed_plugins.includes('caveman'))
})

test('/goal with text sends the remainder', () => {
  const { result, config } = handlePluginSlash('/goal ship 1.0.0', base)
  assert.deepEqual(result, { kind: 'send', text: 'ship 1.0.0' })
  assert.ok(config.active_plugins.includes('goal'))
})
