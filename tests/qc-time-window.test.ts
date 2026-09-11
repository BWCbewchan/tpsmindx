import assert from 'node:assert/strict'
import test from 'node:test'

import { getQCWindowInfo } from '../lib/qc-time-window.ts'

const session = {
  startTime: '2026-08-30T10:00:00.000Z',
  endTime: '2026-08-30T12:00:00.000Z',
}

test('QC creation is available without 24h restrictions (before, during, and after class)', () => {
  // Days before class
  const daysBefore = getQCWindowInfo(
    session,
    new Date('2026-08-01T00:00:00.000Z'),
  )
  assert.equal(daysBefore.canCreateQC, true)
  assert.equal(daysBefore.qcWindowStatus, 'available')

  // During class
  const duringClass = getQCWindowInfo(
    session,
    new Date('2026-08-30T11:00:00.000Z'),
  )
  assert.equal(duringClass.canCreateQC, true)
  assert.equal(duringClass.qcWindowStatus, 'available')

  // Days after class
  const daysAfter = getQCWindowInfo(
    session,
    new Date('2026-09-10T00:00:00.000Z'),
  )
  assert.equal(daysAfter.canCreateQC, true)
  assert.equal(daysAfter.qcWindowStatus, 'available')
})

