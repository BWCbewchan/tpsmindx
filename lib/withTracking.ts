import { withApiProtection } from '@/lib/api-protection'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type RouteHandler = (request: NextRequest) => Promise<NextResponse>

interface WithTrackingOptions {
  endpoint: string
  requireSuperAdmin?: boolean
}

async function getUserRole(email?: string | null) {
  if (!email) return null
  const result = await pool.query(
    'SELECT role FROM app_users WHERE email = $1 AND is_active = true LIMIT 1',
    [email.toLowerCase()],
  )
  return result.rows[0]?.role || null
}

async function trackServerEvent(
  eventName: string,
  request: NextRequest,
  properties: Record<string, unknown>,
) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress =
      forwarded?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || ''

    await pool.query(
      `
        INSERT INTO system_events (event_name, user_id, session_id, properties, user_agent, ip_address)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      `,
      [
        eventName,
        String(properties.user_id || '').slice(0, 255) || null,
        String(properties.session_id || '').slice(0, 100) || null,
        JSON.stringify(properties),
        userAgent.slice(0, 500),
        String(ipAddress || '').slice(0, 45) || null,
      ],
    )
  } catch {
    // Tracking failure must never break primary API response.
  }
}

function getRequestEmail(request: NextRequest, body?: unknown): string {
  const fromQuery = request.nextUrl.searchParams.get('requestEmail')
  if (fromQuery) return fromQuery.trim().toLowerCase()

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const value = record.requestEmail
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase()
    }
  }

  return ''
}

export function withTracking(
  handler: RouteHandler,
  options: WithTrackingOptions,
): RouteHandler {
  return withApiProtection(async (request: NextRequest) => {
    const startedAt = Date.now()
    let trackingEmail = ''

    let parsedBody: unknown
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        parsedBody = await request.clone().json()
      } catch {
        parsedBody = undefined
      }
    }

    const requestEmail = getRequestEmail(request, parsedBody)

    if (options.requireSuperAdmin) {
      const auth = await requireBearerSession(request)
      if (!auth.ok) {
        return auth.response
      }
      if (!auth.privileged) {
        return NextResponse.json(
          { success: false, error: 'Không có quyền truy cập' },
          { status: 403 },
        )
      }
      trackingEmail = auth.sessionEmail
    } else {
      trackingEmail = requestEmail
    }

    try {
      const response = await handler(request)
      const responseTime = Date.now() - startedAt

      await trackServerEvent('api_request', request, {
        endpoint: options.endpoint,
        method: request.method,
        status: response.status,
        response_time: responseTime,
        user_id: trackingEmail || null,
      })

      return response
    } catch (error: unknown) {
      const responseTime = Date.now() - startedAt
      const errorMessage = error instanceof Error ? error.message : 'Unhandled error'

      await trackServerEvent('error', request, {
        endpoint: options.endpoint,
        method: request.method,
        code: 500,
        response_time: responseTime,
        message: errorMessage,
        user_id: trackingEmail || null,
      })

      throw error
    }
  })
}
