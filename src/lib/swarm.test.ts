import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSwarmTasks, swarmWorkersFromArgs } from './swarm.ts'

test('parses JSON roles', () => {
  const tasks = parseSwarmTasks('[{"role":"implementer","task":"write ui"},{"role":"reviewer","task":"review ui"}]')
  assert.equal(tasks.length, 2)
  assert.equal(tasks[0].role, 'implementer')
  assert.equal(tasks[1].task, 'review ui')
})

test('caps at three and assigns sequential ids', () => {
  const workers = swarmWorkersFromArgs({
    goal: 'ship it',
    tasks: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ task: `job ${i}` }))),
  })
  assert.equal(workers.length, 3)
  assert.deepEqual(workers.map((w) => w.id), ['s0', 's1', 's2'])
})

test('goal fallback becomes a lead worker', () => {
  const workers = swarmWorkersFromArgs({ goal: 'ship the swarm' })
  assert.equal(workers.length, 1)
  assert.equal(workers[0].role, 'lead')
  assert.equal(workers[0].task, 'ship the swarm')
})
