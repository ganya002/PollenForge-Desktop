import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addEnabledProvider, findProviderModel, mergeFetchedConfig } from './appConfig.ts'
import type { Config } from '../store/store.ts'

const current: Config = {
  providers: {
    pollinations: {
      api_key: '',
      models: [{ id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', cost_per_1k: 0, context_length: 128000 }],
    },
  },
  enabled_providers: ['pollinations'],
  model: 'gpt-5.6-sol',
  provider: 'pollinations',
  temperature: 0.4,
  max_tokens: 32768,
  auto_approve: true,
}

test('mergeFetchedConfig keeps models when backend omits them', () => {
  const remote = {
    default_provider: 'pollinations',
    default_model: 'gpt-4o',
    providers: {
      pollinations: { enabled: true, api_key: 'sk_test', default_model: 'gpt-4o' },
    },
    temperature: 0.7,
    max_tokens: 4096,
  }
  const merged = mergeFetchedConfig(current, remote)
  assert.equal(merged.providers.pollinations.models[0].id, 'gpt-5.6-sol')
  assert.equal(merged.providers.pollinations.api_key, 'sk_test')
  assert.equal(merged.temperature, 0.7)
  assert.equal(merged.model, 'gpt-5.6-sol')
  assert.equal(findProviderModel(merged, 'pollinations', 'gpt-5.6-sol')?.id, 'gpt-5.6-sol')
})

test('mergeFetchedConfig does not enable every catalog provider', () => {
  const merged = mergeFetchedConfig(current, {
    providers: {
      pollinations: { enabled: true, api_key: '' },
      openai: { enabled: false, api_key: null },
    },
  })
  assert.deepEqual(merged.enabled_providers, ['pollinations'])
})

test('addEnabledProvider hydrates models from the catalog', () => {
  const next = addEnabledProvider(current, 'groq')
  assert.ok(next.enabled_providers.includes('groq'))
  assert.ok(next.providers.groq.models.length > 0)
})

test('findProviderModel does not throw when models is missing', () => {
  const broken = {
    providers: { pollinations: { api_key: '' } },
    enabled_providers: ['pollinations'],
    model: 'x',
    provider: 'pollinations',
    temperature: 0.4,
    max_tokens: 1,
    auto_approve: true,
  } as unknown as Config
  assert.equal(findProviderModel(broken, 'pollinations', 'gpt-5.6-sol'), undefined)
})
