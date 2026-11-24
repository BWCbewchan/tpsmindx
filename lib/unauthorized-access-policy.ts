export function classifyUnauthorizedAccess(hasActor: boolean, recentFailures = 0, alreadyAlerted = false) {
  if (hasActor) return { eventType: 'PRIVILEGE_ESCALATION' as const, action: 'UNAUTHORIZED_ACCESS', severity: 'HIGH' as const, risk: 75 }
  if (recentFailures >= 10 && !alreadyAlerted) return { eventType: 'AUTH' as const, action: 'AUTH_FAILURE_BURST', severity: 'HIGH' as const, risk: 75 }
  return { eventType: 'AUTH' as const, action: 'AUTHENTICATION_REQUIRED', severity: 'WARNING' as const, risk: 25 }
}
