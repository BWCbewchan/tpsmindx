import pool from '@/lib/db'
import { withTracking } from '@/lib/withTracking'
import { NextRequest, NextResponse } from 'next/server'

interface TrackEventPayload {
  event_name: string
  user_id?: string
  session_id?: string
  timestamp?: number
  properties?: Record<string, unknown>
}

/**
 * POST /api/metrics/track
 * Lightweight endpoint — accepts a batch of tracking events.
 */
async function postTrack(request: NextRequest) {
  try {
    const body = await request.json()
    const events: TrackEventPayload[] = Array.isArray(body.events)
      ? body.events
      : body.event_name
        ? [body]
        : []

    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No events' },
        { status: 400 },
      )
    }

    // Limit batch size
    const batch = events.slice(0, 50)

    const userAgent = request.headers.get('user-agent') || ''
    const forwarded = request.headers.get('x-forwarded-for')
    const ip =
      forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''

    // Build multi-row INSERT
    const values: unknown[] = []
    const placeholders: string[] = []

    batch.forEach((evt, i) => {
      const offset = i * 6
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`,
      )
      values.push(
        (evt.event_name || '').slice(0, 100),
        (evt.user_id || '').slice(0, 255) || null,
        (evt.session_id || '').slice(0, 100) || null,
        JSON.stringify(evt.properties || {}),
        userAgent.slice(0, 500),
        ip.slice(0, 45) || null,
      )
    })

    const sql = `
      INSERT INTO system_events (event_name, user_id, session_id, properties, user_agent, ip_address)
      VALUES ${placeholders.join(', ')}
    `

    await pool.query(sql, values)

    return NextResponse.json({ success: true, count: batch.length })
  } catch (error: any) {
    console.warn('[metrics/track] Non-fatal error:', error.message)
    return NextResponse.json(
      { success: false, error: 'Tracking unavailable' },
      { status: 200 },
    )
  }
}

export const POST = withTracking(postTrack, {
  endpoint: '/api/metrics/track',
})
