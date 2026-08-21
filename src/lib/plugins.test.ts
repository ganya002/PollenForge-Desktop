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

test('setPluginActive does not auto-install marketplace plugins', () => {
  const next = setPluginActive(base, 'caveman', true)
  assert.deepEqual(next.installed_plugins, [])
  assert.deepEqual(next.active_plugins, [])
})

test('/caveman is blocked until the plugin is installed', () => {
  const { result, config } = handlePluginSlash('/caveman', base)
  assert.equal(result.kind, 'consumed')
  if (result.kind === 'consumed') assert.match(result.notice, /not installed/i)
  assert.equal(config.active_plugins.includes('caveman'), false)
  assert.equal(config.installed_plugins.includes('caveman'), false)
})

test('/caveman activates when installed', () => {
  const { result, config } = handlePluginSlash('/caveman', installPlugin(base, 'caveman'))
  assert.equal(result.kind, 'consumed')
  assert.ok(config.active_plugins.includes('caveman'))
  assert.ok(config.installed_plugins.includes('caveman'))
})

test('/goal with text sends the remainder when installed', () => {
  const { result, config } = handlePluginSlash('/goal ship 1.0.0', installPlugin(base, 'goal'))
  assert.deepEqual(result, { kind: 'send', text: 'ship 1.0.0' })
  assert.ok(config.active_plugins.includes('goal'))
})

test('/plan with text sends the remainder when installed', () => {
  const { result, config } = handlePluginSlash('/plan add file preview', installPlugin(base, 'planner'))
  assert.deepEqual(result, { kind: 'send', text: 'add file preview' })
  assert.ok(config.active_plugins.includes('planner'))
})

test('activating goal turns plan off and the reverse', () => {
  let cfg = setPluginActive(installPlugin(installPlugin(base, 'goal'), 'planner'), 'planner', true)
  cfg = setPluginActive(cfg, 'goal', true)
  assert.deepEqual(cfg.active_plugins.filter((id) => id === 'goal' || id === 'planner'), ['goal'])
  cfg = setPluginActive(cfg, 'planner', true)
  assert.deepEqual(cfg.active_plugins.filter((id) => id === 'goal' || id === 'planner'), ['planner'])
})
