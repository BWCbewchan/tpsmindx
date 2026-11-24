import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import {
  getVapidConfig,
  isAllowedPushEndpoint,
  sendWebPush,
} from '@/lib/web-push'
import { NextRequest, NextResponse } from 'next/server'

function normalizeEndpoint(value: unknown) {
  const endpoint = String(value || '').trim()
  try {
    const url = new URL(endpoint)
    if (!isAllowedPushEndpoint(url.href)) return null
    return url.href
  } catch {
    return null
  }
}

function normalizeKey(value: unknown) {
  const key = String(value || '').trim()
  return /^[A-Za-z0-9_-]{16,}$/.test(key) ? key : null
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  const config = getVapidConfig()
  return NextResponse.json({
    success: true,
    configured: Boolean(config),
    public_key: config?.publicKey || null,
  })
}

export async function POST(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const endpoint = normalizeEndpoint(body?.endpoint)
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint đăng ký không hợp lệ' },
        { status: 400 },
      )
    }

    const email = auth.sessionEmail.trim().toLowerCase()
    if (body?.action === 'test') {
      const result = await pool.query(
        `SELECT endpoint, p256dh, auth_secret
         FROM push_subscriptions
         WHERE recipient_email = $1 AND endpoint = $2
         LIMIT 1`,
        [email, endpoint],
      )
      const subscription = result.rows[0]
      if (!subscription) {
        return NextResponse.json(
          { success: false, error: 'Thiết bị chưa được đăng ký' },
          { status: 404 },
        )
      }

      const sent = await sendWebPush(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth_secret,
        },
        {
          title: 'Hệ thống TPS',
          body: 'Thông báo thiết bị đã được kích hoạt thành công.',
          link: '/user/thong-bao',
          tag: 'tps-push-test',
        },
      )
      if (!sent.ok) {
        if (sent.status === 404 || sent.status === 410) {
          await pool.query(
            'DELETE FROM push_subscriptions WHERE recipient_email = $1 AND endpoint = $2',
            [email, endpoint],
          )
        }
        return NextResponse.json(
          {
            success: false,
            requiresResubscribe: sent.status === 404 || sent.status === 410,
            error: sent.skipped
              ? 'Máy chủ chưa cấu hình Web Push'
              : 'Không thể gửi thông báo thử tới thiết bị',
          },
          { status: sent.skipped ? 503 : 502 },
        )
      }

      await pool.query(
        `UPDATE push_subscriptions
         SET last_success_at = CURRENT_TIMESTAMP
         WHERE recipient_email = $1 AND endpoint = $2`,
        [email, endpoint],
      )
      return NextResponse.json({ success: true })
    }

    const p256dh = normalizeKey(body?.keys?.p256dh)
    const authSecret = normalizeKey(body?.keys?.auth)
    if (!p256dh || !authSecret) {
      return NextResponse.json(
        { success: false, error: 'Khóa đăng ký thiết bị không hợp lệ' },
        { status: 400 },
      )
    }

    await pool.query(
      `INSERT INTO push_subscriptions (
         recipient_email,
         endpoint,
         p256dh,
         auth_secret,
         user_agent
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
       SET recipient_email = EXCLUDED.recipient_email,
           p256dh = EXCLUDED.p256dh,
           auth_secret = EXCLUDED.auth_secret,
           user_agent = EXCLUDED.user_agent`,
      [
        email,
        endpoint,
        p256dh,
        authSecret,
        request.headers.get('user-agent') || null,
      ],
    )

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('[push-subscriptions][POST]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể đăng ký thông báo thiết bị' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const endpoint = normalizeEndpoint(body?.endpoint)
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint đăng ký không hợp lệ' },
        { status: 400 },
      )
    }

    await pool.query(
      'DELETE FROM push_subscriptions WHERE recipient_email = $1 AND endpoint = $2',
      [auth.sessionEmail.trim().toLowerCase(), endpoint],
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[push-subscriptions][DELETE]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tắt thông báo thiết bị' },
      { status: 500 },
    )
  }
}
