import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAuthenticatedLanding, canSwitchInterface, INTERFACE_SWITCH_DISABLED } from '../lib/teacher-session-routing.ts'

test('switching is preserved for existing managers but can be disabled per account', () => {
  assert.equal(canSwitchInterface({ role: 'manager', isAdmin: true }), true)
  assert.equal(canSwitchInterface({ role: 'manager', isAdmin: true, permissions: [INTERFACE_SWITCH_DISABLED] }), false)
  assert.equal(canSwitchInterface({ role: 'teacher', isAdmin: false }), false)
  assert.equal(canSwitchInterface(null), false)
  assert.equal(canSwitchInterface({ role: 'super_admin', isAdmin: true, permissions: [INTERFACE_SWITCH_DISABLED] }), true)
})

test('restricted managers always land in management, including teacher login selection', () => {
  for (const selectedRole of ['teacher', 'manager'] as const) {
    assert.equal(resolveAuthenticatedLanding({ selectedRole, userRole: 'manager', isAdmin: true,
      permissions: [INTERFACE_SWITCH_DISABLED] }), '/admin/dashboard')
  }
})

test('known teacher enters the teacher portal directly', () => {
  assert.equal(
    resolveAuthenticatedLanding({
      selectedRole: 'teacher',
      userRole: 'teacher',
      isAdmin: false,
      teacherSync: { foundInDatabase: true, dbUnavailable: false },
    }),
    '/user/truyenthong',
  )
})

test('teacher missing from database must use checkdatasource', () => {
  assert.equal(
    resolveAuthenticatedLanding({
      selectedRole: 'teacher',
      userRole: 'teacher',
      isAdmin: false,
      teacherSync: { foundInDatabase: false, dbUnavailable: false },
    }),
    '/checkdatasource',
  )
})

test('unknown teacher state fails closed to checkdatasource', () => {
  assert.equal(
    resolveAuthenticatedLanding({
      selectedRole: 'teacher',
      userRole: 'teacher',
      isAdmin: false,
    }),
    '/checkdatasource',
  )
})

test('database outage does not incorrectly classify a teacher as missing', () => {
  assert.equal(
    resolveAuthenticatedLanding({
      selectedRole: 'teacher',
      userRole: 'teacher',
      isAdmin: false,
      teacherSync: { foundInDatabase: false, dbUnavailable: true },
    }),
    '/user/truyenthong',
  )
})

test('admin selecting manager mode enters admin dashboard', () => {
  assert.equal(
    resolveAuthenticatedLanding({
      selectedRole: 'manager',
      userRole: 'manager',
      isAdmin: true,
    }),
    '/admin/dashboard',
  )
})

test('admin selecting teacher mode enters teacher portal', () => {
  assert.equal(
    resolveAuthenticatedLanding({
      selectedRole: 'teacher',
      userRole: 'manager',
      isAdmin: true,
    }),
    '/user/truyenthong',
  )
})
