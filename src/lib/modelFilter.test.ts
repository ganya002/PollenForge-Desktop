import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatModelCost, isFreeModel, isPopularModel, visibleModels } from './modelFilter.ts'

test('visibleModels filters free, popular, and all', () => {
  const models = [
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', cost_per_1k: 0.002, free: false },
    { id: 'openai/gpt-4o', name: 'GPT-4o', cost_per_1k: 0.005, free: false },
    { id: 'vendor/laguna:free', name: 'Laguna', cost_per_1k: 0, free: true },
    { id: 'obscure/lab-model', name: 'Obscure', cost_per_1k: 0.001, free: false },
  ]
  assert.equal(visibleModels(models, 'all').length, 4)
  assert.deepEqual(visibleModels(models, 'free').map((m) => m.id), ['vendor/laguna:free'])
  assert.deepEqual(visibleModels(models, 'popular').map((m) => m.id), ['gpt-5.6-sol', 'openai/gpt-4o'])
})

test('isPopularModel treats first-party Pollinations and flagship OpenRouter ids as popular', () => {
  assert.equal(isPopularModel({ id: 'kimi-k3' }), true)
  assert.equal(isPopularModel({ id: 'anthropic/claude-sonnet-4' }), true)
  assert.equal(isPopularModel({ id: 'somebody/random-finetune' }), false)
})


test('isFreeModel uses :free, free flag, and zero cost', () => {
  assert.equal(isFreeModel({ id: 'x:free', cost_per_1k: 1 }), true)
  assert.equal(isFreeModel({ id: 'paid', cost_per_1k: 0.01, free: false }), false)
  assert.equal(isFreeModel({ id: 'old', cost_per_1k: 0 }), true)
  assert.equal(isFreeModel({ id: 'flagged', cost_per_1k: 0.01, free: true }), true)
})

test('formatModelCost shows Free, USD, and Pollen in/out', () => {
  assert.equal(formatModelCost({ id: 'a', cost_per_1k: 0, free: true }), 'Free')
  assert.equal(formatModelCost({ id: 'b', cost_per_1k: 0.005, free: false }), '$0.005/1k')
  assert.equal(
    formatModelCost({
      id: 'openai',
      cost_per_1k: 0.0010875,
      cost_in_per_1k: 0.00015,
      cost_out_per_1k: 0.0009375,
      cost_currency: 'pollen',
      free: false,
    }),
    '0.15/0.94 P/M',
  )
  assert.equal(
    formatModelCost({
      id: 'openai/gpt-4o',
      cost_per_1k: 0.0125,
      cost_in_per_1k: 0.0025,
      cost_out_per_1k: 0.01,
      cost_currency: 'usd',
      free: false,
    }),
    '$2.50/$10 /M',
  )
})
