import assert from 'node:assert/strict'
import test from 'node:test'

import { computeCycleScore } from '../lib/score-cycle.ts'

const score = (month: string, average: number, count = 1) => ({
  month,
  average,
  count,
})

test('hailt: renews the expired 9.3 cycle using August 9.1 through next July', () => {
  const data = [score('9/2025', 9.3), score('8/2026', 9.1)]

  assert.equal(computeCycleScore(data, 8, 2026), '9.3')
  assert.equal(computeCycleScore(data, 9, 2026), '9.1')
  assert.equal(computeCycleScore(data, 7, 2027), '9.1')
  assert.equal(computeCycleScore(data, 8, 2027), 'N/A')
})

test('keeps higher scores during a cycle and restarts immediately for an improvement', () => {
  const data = [score('1/2026', 8), score('4/2026', 7), score('6/2026', 9)]

  assert.equal(computeCycleScore(data, 4, 2026), '8.0')
  assert.equal(computeCycleScore(data, 6, 2026), '9.0')
  assert.equal(computeCycleScore(data, 5, 2027), '9.0')
  assert.equal(computeCycleScore(data, 6, 2027), 'N/A')
})

test('uses the latest result rather than the highest lower result at renewal', () => {
  const data = [score('9/2025', 9.3), score('5/2026', 9.2), score('8/2026', 7)]

  assert.equal(computeCycleScore(data, 9, 2026), '7.0')
})

test('an equal score also renews the cycle from its own exam month', () => {
  const data = [score('9/2025', 9.3), score('8/2026', 9.3)]

  assert.equal(computeCycleScore(data, 7, 2027), '9.3')
  assert.equal(computeCycleScore(data, 8, 2027), 'N/A')
})

test('renewal happens before considering a lower exam after the old cycle expires', () => {
  const data = [score('9/2025', 9.3), score('8/2026', 9.1), score('10/2026', 8)]

  assert.equal(computeCycleScore(data, 10, 2026), '9.1')
  assert.equal(computeCycleScore(data, 8, 2027), '8.0')
  assert.equal(computeCycleScore(data, 9, 2027), '8.0')
  assert.equal(computeCycleScore(data, 10, 2027), 'N/A')
})

test('a higher exam after renewal starts a new 12-month cycle', () => {
  const data = [score('9/2025', 9.3), score('8/2026', 8), score('10/2026', 9)]

  assert.equal(computeCycleScore(data, 10, 2026), '9.0')
  assert.equal(computeCycleScore(data, 9, 2027), '9.0')
  assert.equal(computeCycleScore(data, 10, 2027), 'N/A')
})

test('a result older than 12 months cannot renew indefinitely', () => {
  const data = [score('1/2025', 9.3), score('2/2025', 9.1)]

  assert.equal(computeCycleScore(data, 1, 2026), '9.1')
  assert.equal(computeCycleScore(data, 2, 2026), 'N/A')
  assert.equal(computeCycleScore(data, 1, 2030), 'N/A')
})

test('starts from a new result after a gap with no valid score', () => {
  const data = [score('1/2025', 9.3), score('2/2025', 9.1), score('5/2026', 7)]

  assert.equal(computeCycleScore(data, 4, 2026), 'N/A')
  assert.equal(computeCycleScore(data, 5, 2026), '7.0')
  assert.equal(computeCycleScore(data, 4, 2027), '7.0')
})

test('ignores future and exempt-only months, but keeps a valid zero score', () => {
  const data = [score('9/2025', 9.3), score('7/2026', 0), score('8/2026', 0, 0), score('10/2026', 10)]

  assert.equal(computeCycleScore(data, 8, 2025), 'N/A')
  assert.equal(computeCycleScore(data, 9, 2026), '0.0')
  assert.equal(computeCycleScore([], 9, 2026), 'N/A')
})

test('accepts newest-first API data without mutating its order', () => {
  const data = [score('8/2026', 9.1), score('9/2025', 9.3)]
  const original = structuredClone(data)

  assert.equal(computeCycleScore(data, 9, 2026), '9.1')
  assert.deepEqual(data, original)
})
