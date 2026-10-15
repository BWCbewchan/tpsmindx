import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getJwtSecret } from '@/lib/jwt-secret'
import type { LmsCentre } from './lms'
import { centreMatchesHint } from './normalize'

export interface TpsAccessibleCentre {
  id: number
  full_name: string
  short_code: string | null
}

interface TicketMutationClaims {
  scope: 'teacher-evaluation-ticket'
  ticketId: string
  email: string
  centreId: string
  expiresAt: number
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function signature(payload: string): string {
  return createHmac('sha256', getJwtSecret()).update(payload).digest('base64url')
}

export function resolveAccessibleLmsCentres(
  centres: LmsCentre[],
  accessibleCentres: TpsAccessibleCentre[],
  isSuperAdmin: boolean,
): LmsCentre[] {
  if (isSuperAdmin) return centres
  return centres.filter((centre) => accessibleCentres.some((allowed) =>
    centreMatchesHint(centre, [allowed.short_code || '', allowed.full_name]),
  ))
}

export function createTicketMutationToken(input: {
  ticketId: string
  email: string
  centreId: string
}): string {
  const claims: TicketMutationClaims = {
    scope: 'teacher-evaluation-ticket',
    ticketId: input.ticketId,
    email: input.email.trim().toLowerCase(),
    centreId: input.centreId,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  }
  const payload = encode(JSON.stringify(claims))
  return `${payload}.${signature(payload)}`
}

export function verifyTicketMutationToken(
  token: string,
  input: { ticketId: string; email: string },
): TicketMutationClaims | null {
  const [payload, providedSignature, extra] = String(token || '').split('.')
  if (!payload || !providedSignature || extra) return null
  const expectedSignature = signature(payload)
  const provided = Buffer.from(providedSignature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TicketMutationClaims
    if (
      claims.scope !== 'teacher-evaluation-ticket' ||
      claims.ticketId !== input.ticketId ||
      claims.email !== input.email.trim().toLowerCase() ||
      !Number.isFinite(claims.expiresAt) ||
      claims.expiresAt < Date.now()
    ) return null
    return claims
  } catch {
    return null
  }
}
