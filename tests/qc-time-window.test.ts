import assert from 'node:assert/strict'
import test from 'node:test'

import { getQCWindowInfo } from '../lib/qc-time-window.ts'

const session = {
  startTime: '2026-08-30T10:00:00.000Z',
  endTime: '2026-08-30T12:00:00.000Z',
}

test('QC window opens 24 hours before class start', () => {
  const beforeWindow = getQCWindowInfo(
    session,
    new Date('2026-08-29T09:59:59.999Z'),
  )
  assert.equal(beforeWindow.canCreateQC, false)
  assert.equal(beforeWindow.qcWindowStatus, 'upcoming')

  const atWindowStart = getQCWindowInfo(
    session,
    new Date('2026-08-29T10:00:00.000Z'),
  )
  assert.equal(atWindowStart.canCreateQC, true)
  assert.equal(atWindowStart.qcWindowStatus, 'available')
  assert.equal(atWindowStart.availableFrom, '2026-08-29T10:00:00.000Z')
})

test('QC window stays open through 24 hours after class end', () => {
  const duringClass = getQCWindowInfo(
    session,
    new Date('2026-08-30T11:00:00.000Z'),
  )
  assert.equal(duringClass.canCreateQC, true)
  assert.equal(duringClass.qcWindowStatus, 'available')

  const atWindowEnd = getQCWindowInfo(
    session,
    new Date('2026-08-31T12:00:00.000Z'),
  )
  assert.equal(atWindowEnd.canCreateQC, true)
  assert.equal(atWindowEnd.availableUntil, '2026-08-31T12:00:00.000Z')

  const afterWindow = getQCWindowInfo(
    session,
    new Date('2026-08-31T12:00:00.001Z'),
  )
  assert.equal(afterWindow.canCreateQC, false)
  assert.equal(afterWindow.qcWindowStatus, 'expired')
})

