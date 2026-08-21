import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isFreeModel, visibleModels } from './modelFilter.ts'

test('paid models are hidden only when free-only is on', () => {
  const models = [
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', cost_per_1k: 0.002, context_length: 128000, free: false },
    { id: 'openai', name: 'OpenAI', cost_per_1k: 0.001, context_length: 400000, free: false },
    { id: 'vendor/laguna:free', name: 'Laguna', cost_per_1k: 0, context_length: 128000, free: true },
  ]
  assert.equal(visibleModels(models, false).length, 3)
  const freeOnly = visibleModels(models, true)
  assert.deepEqual(freeOnly.map((m) => m.id), ['vendor/laguna:free'])
})

test('isFreeModel uses :free, free flag, and zero cost', () => {
  assert.equal(isFreeModel({ id: 'x:free', cost_per_1k: 1 }), true)
  assert.equal(isFreeModel({ id: 'paid', cost_per_1k: 0.01, free: false }), false)
  assert.equal(isFreeModel({ id: 'old', cost_per_1k: 0 }), true)
  assert.equal(isFreeModel({ id: 'flagged', cost_per_1k: 0.01, free: true }), true)
})
