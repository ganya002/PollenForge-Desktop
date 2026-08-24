import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeReasoning, splitThinkTags } from './thinking.ts'

test('splitThinkTags leaves ordinary answers alone', () => {
  assert.deepEqual(splitThinkTags('Hello there'), { content: 'Hello there', reasoning: '' })
})

test('splitThinkTags pulls out a closed think block', () => {
  const split = splitThinkTags('<think>plan first</think>\n\nHere is the answer')
  assert.equal(split.reasoning, 'plan first')
  assert.equal(split.content.trim(), 'Here is the answer')
})

test('splitThinkTags treats an unclosed think tag as live reasoning', () => {
  const split = splitThinkTags('prefix <think>still thinking')
  assert.equal(split.content, 'prefix ')
  assert.equal(split.reasoning, 'still thinking')
})

test('mergeReasoning does not duplicate overlapping chunks', () => {
  assert.equal(mergeReasoning('abc', 'bc'), 'abc')
  assert.equal(mergeReasoning('ab', 'abcd'), 'abcd')
  assert.equal(mergeReasoning('one', 'two'), 'one\n\ntwo')
})
