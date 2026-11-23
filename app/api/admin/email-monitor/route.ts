import {
  getMailTransportConfiguration,
  sendMail,
  verifyMailTransport,
} from '@/app/api/emails/transporter'
import {
  requireBearerSuperAdmin,
  requireBearerSuperAdminMutation,
} from '@/lib/auth-server'
import pool from '@/lib/db'
import {
  createDatabaseEmailSenderAccount,
  deleteDatabaseEmailSenderAccount,
  getEmailSenderAccount,
  isEmailCredentialEncryptionConfigured,
  listEmailSenderAccountsWithQuota,
  updateEmailSenderAccount,
} from '@/lib/email-accounts'
import { deriveEmailHealth } from '@/lib/email-monitoring'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const PERIODS = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
} as const

type PeriodKey = keyof typeof PERIODS
type DashboardRow = Record<string, unknown>

type EmailSeriesRow = {
  bucket: string
  attempts: unknown
  sent: unknown
  failed: unknown
  skipped?: unknown
  recipients: unknown
  avg_latency_ms: unknown
}

const DEFAULT_SETTINGS = {
  dailyMessageLimit: 2000,
  dailyRecipientLimit: 10000,
  warningThresholdPercent: 80,
  latencyWarningMs: 5000,
  failureRateWarningPercent: 5,
  retentionDays: 90,
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toInteger(value: unknown): number {
  return Math.round(toNumber(value))
}

function parseSettings(row: Record<string, unknown> | undefined) {
  if (!row) return DEFAULT_SETTINGS
  return {
    dailyMessageLimit: toInteger(row.daily_message_limit),
    dailyRecipientLimit: toInteger(row.daily_recipient_limit),
    warningThresholdPercent: toNumber(row.warning_threshold_percent),
    latencyWarningMs: toInteger(row.latency_warning_ms),
    failureRateWarningPercent: toNumber(
      row.failure_rate_warning_percent,
    ),
    retentionDays: toInteger(row.retention_days),
    updatedAt: row.updated_at || null,
    updatedByEmail: row.updated_by_email || null,
  }
}

function parseSummary(row: Record<string, unknown> | undefined) {
  return {
    attempts: toInteger(row?.attempts),
    sent: toInteger(row?.sent),
    failed: toInteger(row?.failed),
    skipped: toInteger(row?.skipped),
    messages: toInteger(row?.messages),
    recipients: toInteger(row?.recipients),
    avgLatencyMs: toInteger(row?.avg_latency_ms),
    p95LatencyMs: toInteger(row?.p95_latency_ms),
    maxLatencyMs: toInteger(row?.max_latency_ms),
  }
}

async function waitForMigrations() {
  if (global.migrationInitPromise) {
    await global.migrationInitPromise
  }
}

function buildLogFilters(searchParams: URLSearchParams, interval: string) {
  const conditions = [`created_at >= NOW() - $1::interval`]
  const values: unknown[] = [interval]

  const accountId = Number(searchParams.get('accountId'))
  if (Number.isSafeInteger(accountId) && accountId > 0) {
    values.push(accountId)
    conditions.push(`sender_account_id = $${values.length}`)
  }
  const status = searchParams.get('status')?.trim()
  if (status && ['sent', 'failed', 'skipped'].includes(status)) {
    values.push(status)
    conditions.push(`status = $${values.length}`)
  }

  const category = searchParams.get('category')?.trim()
  if (category) {
    values.push(category)
    conditions.push(`error_category = $${values.length}`)
  }

  const emailType = searchParams.get('emailType')?.trim()
  if (emailType) {
    values.push(emailType)
    conditions.push(`email_type = $${values.length}`)
  }

  const search = searchParams.get('search')?.trim()
  if (search) {
    values.push(`%${search}%`)
    const placeholder = `$${values.length}`
    conditions.push(`(
      subject ILIKE ${placeholder}
      OR COALESCE(error_message, '') ILIKE ${placeholder}
      OR COALESCE(provider_message_id, '') ILIKE ${placeholder}
      OR array_to_string(to_recipients, ',') ILIKE ${placeholder}
      OR array_to_string(cc_recipients, ',') ILIKE ${placeholder}
      OR COALESCE(metadata::text, '') ILIKE ${placeholder}
    )`)
  }

  return { conditions, values }
}

export async function GET(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  try {
    await waitForMigrations()
    const searchParams = request.nextUrl.searchParams
    const periodParam = searchParams.get('period') as PeriodKey | null
    const period: PeriodKey =
      periodParam && periodParam in PERIODS ? periodParam : '24h'
    const interval = PERIODS[period]
    const page = Math.max(1, toInteger(searchParams.get('page') || 1))
    const pageSize = Math.min(
      100,
      Math.max(10, toInteger(searchParams.get('pageSize') || 25)),
    )

    const { conditions, values } = buildLogFilters(searchParams, interval)
    const whereSql = conditions.join(' AND ')
    const offset = (page - 1) * pageSize
    const dashboardResult = await pool.query(
      `WITH
      period_logs AS MATERIALIZED (
        SELECT *
        FROM email_delivery_logs
        WHERE created_at >= NOW() - $1::interval
      ),
      quota_logs AS MATERIALIZED (
        SELECT *
        FROM email_delivery_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      ),
      filtered_logs AS MATERIALIZED (
        SELECT *
        FROM email_delivery_logs
        WHERE ${whereSql}
      ),
      summary_data AS (
        SELECT
          COUNT(*)::int AS attempts,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS messages,
          COALESCE(SUM(recipient_count) FILTER (WHERE status = 'sent'), 0)::int AS recipients,
          COALESCE(AVG(duration_ms), 0)::numeric AS avg_latency_ms,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::numeric AS p95_latency_ms,
          COALESCE(MAX(duration_ms), 0)::int AS max_latency_ms
        FROM period_logs
      ),
      quota_data AS (
        SELECT
          COUNT(*)::int AS attempts,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS messages,
          COALESCE(SUM(recipient_count) FILTER (WHERE status = 'sent'), 0)::int AS recipients,
          COALESCE(AVG(duration_ms), 0)::numeric AS avg_latency_ms,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::numeric AS p95_latency_ms,
          COALESCE(MAX(duration_ms), 0)::int AS max_latency_ms
        FROM quota_logs
      ),
      hourly_data AS (
        SELECT COALESCE(json_agg(row_to_json(hour_row) ORDER BY hour_row.bucket), '[]'::json) AS data
        FROM (
          SELECT
            hours.bucket,
            COUNT(logs.id)::int AS attempts,
            COUNT(logs.id) FILTER (WHERE logs.status = 'sent')::int AS sent,
            COUNT(logs.id) FILTER (WHERE logs.status = 'failed')::int AS failed,
            COUNT(logs.id) FILTER (WHERE logs.status = 'skipped')::int AS skipped,
            COALESCE(SUM(logs.recipient_count) FILTER (WHERE logs.status = 'sent'), 0)::int AS recipients,
            COALESCE(AVG(logs.duration_ms), 0)::numeric AS avg_latency_ms
          FROM generate_series(
            date_trunc('hour', NOW() - INTERVAL '23 hours'),
            date_trunc('hour', NOW()),
            INTERVAL '1 hour'
          ) AS hours(bucket)
          LEFT JOIN quota_logs logs
            ON logs.created_at >= hours.bucket
            AND logs.created_at < hours.bucket + INTERVAL '1 hour'
          GROUP BY hours.bucket
        ) hour_row
      ),
      daily_data AS (
        SELECT COALESCE(json_agg(row_to_json(day_row) ORDER BY day_row.bucket), '[]'::json) AS data
        FROM (
          SELECT
            days.bucket,
            COUNT(logs.id)::int AS attempts,
            COUNT(logs.id) FILTER (WHERE logs.status = 'sent')::int AS sent,
            COUNT(logs.id) FILTER (WHERE logs.status = 'failed')::int AS failed,
            COALESCE(SUM(logs.recipient_count) FILTER (WHERE logs.status = 'sent'), 0)::int AS recipients,
            COALESCE(AVG(logs.duration_ms), 0)::numeric AS avg_latency_ms
          FROM generate_series(
            date_trunc('day', NOW() - INTERVAL '13 days'),
            date_trunc('day', NOW()),
            INTERVAL '1 day'
          ) AS days(bucket)
          LEFT JOIN email_delivery_logs logs
            ON logs.created_at >= days.bucket
            AND logs.created_at < days.bucket + INTERVAL '1 day'
          GROUP BY days.bucket
        ) day_row
      ),
      status_data AS (
        SELECT COALESCE(json_agg(row_to_json(status_row) ORDER BY status_row.count DESC), '[]'::json) AS data
        FROM (
          SELECT status AS name, COUNT(*)::int AS count
          FROM period_logs
          GROUP BY status
        ) status_row
      ),
      error_data AS (
        SELECT COALESCE(json_agg(row_to_json(error_row) ORDER BY error_row.count DESC, error_row.last_seen_at DESC), '[]'::json) AS data
        FROM (
          SELECT
            COALESCE(error_category, 'unknown') AS category,
            COALESCE(error_code, 'UNKNOWN') AS code,
            COUNT(*)::int AS count,
            MAX(created_at) AS last_seen_at,
            MAX(error_message) AS sample_message
          FROM period_logs
          WHERE status IN ('failed', 'skipped')
          GROUP BY 1, 2
          ORDER BY count DESC, last_seen_at DESC
          LIMIT 20
        ) error_row
      ),
      type_data AS (
        SELECT COALESCE(json_agg(row_to_json(type_row) ORDER BY type_row.count DESC), '[]'::json) AS data
        FROM (
          SELECT email_type AS name, COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
          FROM period_logs
          GROUP BY email_type
          ORDER BY count DESC
          LIMIT 20
        ) type_row
      ),
      source_data AS (
        SELECT COALESCE(json_agg(row_to_json(source_row) ORDER BY source_row.count DESC), '[]'::json) AS data
        FROM (
          SELECT source AS name, COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
          FROM period_logs
          GROUP BY source
          ORDER BY count DESC
          LIMIT 20
        ) source_row
      ),
      latency_data AS (
        SELECT COALESCE(json_agg(row_to_json(latency_row) ORDER BY latency_row.sort_order), '[]'::json) AS data
        FROM (
          SELECT bucket AS name, COUNT(*)::int AS count, sort_order
          FROM (
            SELECT CASE
              WHEN duration_ms < 500 THEN '< 0.5s'
              WHEN duration_ms < 1000 THEN '0.5-1s'
              WHEN duration_ms < 3000 THEN '1-3s'
              WHEN duration_ms < 5000 THEN '3-5s'
              WHEN duration_ms < 10000 THEN '5-10s'
              ELSE '>= 10s'
            END AS bucket,
            CASE
              WHEN duration_ms < 500 THEN 1
              WHEN duration_ms < 1000 THEN 2
              WHEN duration_ms < 3000 THEN 3
              WHEN duration_ms < 5000 THEN 4
              WHEN duration_ms < 10000 THEN 5
              ELSE 6
            END AS sort_order
            FROM period_logs
          ) latency
          GROUP BY bucket, sort_order
        ) latency_row
      ),
      log_page AS (
        SELECT COALESCE(json_agg(row_to_json(log_row) ORDER BY log_row.created_at DESC), '[]'::json) AS data
        FROM (
          SELECT
            id, status, sender_email, to_recipients, cc_recipients,
            recipient_count, subject, email_type, source, duration_ms,
            provider_message_id, smtp_response, error_code, error_category,
            error_message, response_code, retryable, metadata,
            created_at, completed_at
          FROM filtered_logs
          ORDER BY created_at DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        ) log_row
      ),
      recent_data AS (
        SELECT COALESCE(json_agg(row_to_json(recent_row) ORDER BY recent_row.created_at DESC), '[]'::json) AS data
        FROM (
          SELECT status, created_at, error_category, error_code, error_message
          FROM email_delivery_logs
          ORDER BY created_at DESC
          LIMIT 50
        ) recent_row
      )
      SELECT
        row_to_json(settings_row) AS settings,
        row_to_json(summary_data) AS summary,
        row_to_json(quota_data) AS quota,
        hourly_data.data AS hourly,
        daily_data.data AS daily,
        status_data.data AS statuses,
        error_data.data AS errors,
        type_data.data AS email_types,
        source_data.data AS sources,
        latency_data.data AS latency,
        log_page.data AS logs,
        (SELECT COUNT(*)::int FROM filtered_logs) AS log_count,
        recent_data.data AS recent
      FROM
        (SELECT * FROM email_monitor_settings WHERE id = 1 LIMIT 1) settings_row
        CROSS JOIN summary_data
        CROSS JOIN quota_data
        CROSS JOIN hourly_data
        CROSS JOIN daily_data
        CROSS JOIN status_data
        CROSS JOIN error_data
        CROSS JOIN type_data
        CROSS JOIN source_data
        CROSS JOIN latency_data
        CROSS JOIN log_page
        CROSS JOIN recent_data`,
      [...values, pageSize, offset],
    )

    const dashboard = dashboardResult.rows[0] || {}
    const settings = parseSettings(dashboard.settings)
    const summary = parseSummary(dashboard.summary)
    const quota24h = parseSummary(dashboard.quota)
    const recentRows: DashboardRow[] = Array.isArray(dashboard.recent)
      ? dashboard.recent as DashboardRow[]
      : []
    const accounts = await listEmailSenderAccountsWithQuota()
    const configuration = await getMailTransportConfiguration(accounts)
    const health = deriveEmailHealth(quota24h, settings, {
      gmailConfigured: configuration.configured,
      internalSecretConfigured: Boolean(
        process.env.INTERNAL_API_SECRET ||
          process.env.EMAIL_INTERNAL_API_SECRET,
      ),
    })

    let consecutiveFailures = 0
    for (const row of recentRows) {
      if (row.status === 'sent') break
      if (row.status === 'failed' || row.status === 'skipped') {
        consecutiveFailures += 1
      }
    }

    const hourlyRows: EmailSeriesRow[] = Array.isArray(dashboard.hourly)
      ? dashboard.hourly as EmailSeriesRow[]
      : []
    const hourly = hourlyRows.map((row) => ({
      bucket: row.bucket,
      attempts: toInteger(row.attempts),
      sent: toInteger(row.sent),
      failed: toInteger(row.failed),
      skipped: toInteger(row.skipped),
      recipients: toInteger(row.recipients),
      avgLatencyMs: toInteger(row.avg_latency_ms),
    }))
    const peakHour = hourly.reduce(
      (peak, item) => (item.attempts > peak.attempts ? item : peak),
      hourly[0] || {
        bucket: null,
        attempts: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        recipients: 0,
        avgLatencyMs: 0,
      },
    )

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      period,
      summary,
      quota24h,
      health,
      settings,
      configuration: {
        ...configuration,
        internalSecretConfigured: Boolean(
          process.env.INTERNAL_API_SECRET ||
            process.env.EMAIL_INTERNAL_API_SECRET,
        ),
        databaseConnected: true,
      },
      diagnostics: {
        consecutiveFailures,
        peakHour,
        latestFailure:
          recentRows.find((row) => row.status === 'failed') || null,
        latestAttempt: recentRows[0] || null,
      },
      hourly,
      daily: (
        Array.isArray(dashboard.daily)
          ? dashboard.daily as EmailSeriesRow[]
          : []
      ).map((row) => ({
        bucket: row.bucket,
        attempts: toInteger(row.attempts),
        sent: toInteger(row.sent),
        failed: toInteger(row.failed),
        recipients: toInteger(row.recipients),
        avgLatencyMs: toInteger(row.avg_latency_ms),
      })),
      breakdowns: {
        status: (
          Array.isArray(dashboard.statuses)
            ? dashboard.statuses as DashboardRow[]
            : []
        ).map((row) => ({
          name: row.name,
          count: toInteger(row.count),
        })),
        errors: (
          Array.isArray(dashboard.errors)
            ? dashboard.errors as DashboardRow[]
            : []
        ).map((row) => ({
          category: row.category,
          code: row.code,
          count: toInteger(row.count),
          lastSeenAt: row.last_seen_at,
          sampleMessage: row.sample_message,
        })),
        emailTypes: (
          Array.isArray(dashboard.email_types)
            ? dashboard.email_types as DashboardRow[]
            : []
        ).map((row) => ({
          name: row.name,
          count: toInteger(row.count),
          failed: toInteger(row.failed),
        })),
        sources: (
          Array.isArray(dashboard.sources)
            ? dashboard.sources as DashboardRow[]
            : []
        ).map((row) => ({
          name: row.name,
          count: toInteger(row.count),
          failed: toInteger(row.failed),
        })),
        latency: (
          Array.isArray(dashboard.latency)
            ? dashboard.latency as DashboardRow[]
            : []
        ).map((row) => ({
          name: row.name,
          count: toInteger(row.count),
        })),
      },
      logs: Array.isArray(dashboard.logs) ? dashboard.logs : [],
      pagination: {
        page,
        pageSize,
        total: toInteger(dashboard.log_count),
        totalPages: Math.max(
          1,
          Math.ceil(toInteger(dashboard.log_count) / pageSize),
        ),
      },
      accounts,
      credentialEncryptionConfigured: isEmailCredentialEncryptionConfigured(),
    })
  } catch (error) {
    console.error('[admin/email-monitor] GET failed:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Không tải được dữ liệu giám sát email',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireBearerSuperAdminMutation(request)
  if (!gate.ok) return gate.response

  try {
    await waitForMigrations()
    const body = await request.json()

    if (body.accountId !== undefined && body.accountId !== null) {
      const accountId = toInteger(body.accountId)
      if (accountId <= 0) {
        return NextResponse.json(
          { success: false, error: 'accountId không hợp lệ.' },
          { status: 400 },
        )
      }

      const updated = await updateEmailSenderAccount({
        accountId,
        ...(typeof body.isActive === 'boolean'
          ? { isActive: body.isActive }
          : {}),
        ...(body.displayName !== undefined
          ? { displayName: String(body.displayName) }
          : {}),
        ...(body.dailyToLimit !== undefined
          ? { dailyToLimit: toInteger(body.dailyToLimit) }
          : {}),
        ...(body.dailyCcLimit !== undefined
          ? { dailyCcLimit: toInteger(body.dailyCcLimit) }
          : {}),
        ...(body.appPassword !== undefined
          ? { appPassword: String(body.appPassword) }
          : {}),
      })

      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tài khoản email.' },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, account: updated })
    }

    const settings = {
      dailyMessageLimit: toInteger(body.dailyMessageLimit),
      dailyRecipientLimit: toInteger(body.dailyRecipientLimit),
      warningThresholdPercent: toNumber(body.warningThresholdPercent),
      latencyWarningMs: toInteger(body.latencyWarningMs),
      failureRateWarningPercent: toNumber(
        body.failureRateWarningPercent,
      ),
      retentionDays: toInteger(body.retentionDays),
    }

    if (
      settings.dailyMessageLimit <= 0 ||
      settings.dailyRecipientLimit <= 0 ||
      settings.warningThresholdPercent <= 0 ||
      settings.warningThresholdPercent > 100 ||
      settings.latencyWarningMs <= 0 ||
      settings.failureRateWarningPercent <= 0 ||
      settings.failureRateWarningPercent > 100 ||
      settings.retentionDays < 7 ||
      settings.retentionDays > 730
    ) {
      return NextResponse.json(
        { success: false, error: 'Ngưỡng cấu hình không hợp lệ.' },
        { status: 400 },
      )
    }

    const result = await pool.query(
      `INSERT INTO email_monitor_settings (
        id, daily_message_limit, daily_recipient_limit,
        warning_threshold_percent, latency_warning_ms,
        failure_rate_warning_percent, retention_days,
        updated_by_email, updated_at
      ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        daily_message_limit = EXCLUDED.daily_message_limit,
        daily_recipient_limit = EXCLUDED.daily_recipient_limit,
        warning_threshold_percent = EXCLUDED.warning_threshold_percent,
        latency_warning_ms = EXCLUDED.latency_warning_ms,
        failure_rate_warning_percent = EXCLUDED.failure_rate_warning_percent,
        retention_days = EXCLUDED.retention_days,
        updated_by_email = EXCLUDED.updated_by_email,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        settings.dailyMessageLimit,
        settings.dailyRecipientLimit,
        settings.warningThresholdPercent,
        settings.latencyWarningMs,
        settings.failureRateWarningPercent,
        settings.retentionDays,
        gate.sessionEmail,
      ],
    )

    return NextResponse.json({
      success: true,
      settings: parseSettings(result.rows[0]),
    })
  } catch (error) {
    console.error('[admin/email-monitor] PATCH failed:', error)
    return NextResponse.json(
      { success: false, error: 'Không lưu được cấu hình giám sát email.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireBearerSuperAdminMutation(request)
  if (!gate.ok) return gate.response

  try {
    await waitForMigrations()
    const body = await request.json()
    const action = String(body.action || '')

    if (action === 'verify') {
      const accountId = body.accountId ? toInteger(body.accountId) : undefined
      const result = await verifyMailTransport(accountId)
      return NextResponse.json(
        {
          success: result.ok,
          result,
          error: result.ok ? undefined : result.error || 'Kết nối Gmail thất bại.',
        },
        { status: result.ok ? 200 : 503 },
      )
    }

    if (action === 'create_account') {
      const account = await createDatabaseEmailSenderAccount({
        email: String(body.email || ''),
        displayName: String(body.displayName || 'TPS Teaching'),
        appPassword: String(body.appPassword || ''),
        dailyToLimit: body.dailyToLimit
          ? toInteger(body.dailyToLimit)
          : undefined,
        dailyCcLimit: body.dailyCcLimit
          ? toInteger(body.dailyCcLimit)
          : undefined,
        createdByEmail: gate.sessionEmail,
      })
      return NextResponse.json({ success: true, account })
    }

    if (action === 'verify_account') {
      const accountId = toInteger(body.accountId)
      if (accountId <= 0) {
        return NextResponse.json(
          { success: false, error: 'accountId không hợp lệ.' },
          { status: 400 },
        )
      }
      const result = await verifyMailTransport(accountId)
      return NextResponse.json(
        {
          success: result.ok,
          result,
          error: result.ok ? undefined : result.error || 'Kết nối Gmail thất bại.',
        },
        { status: result.ok ? 200 : 503 },
      )
    }

    if (action === 'test_send') {
      const recipient = String(body.recipient || gate.sessionEmail).trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return NextResponse.json(
          { success: false, error: 'Email nhận thử không hợp lệ.' },
          { status: 400 },
        )
      }

      const accountId = body.accountId ? toInteger(body.accountId) : undefined
      if (accountId !== undefined && accountId <= 0) {
        return NextResponse.json(
          { success: false, error: 'accountId không hợp lệ.' },
          { status: 400 },
        )
      }

      let senderEmailLabel = ''
      if (accountId !== undefined) {
        const senderAccount = await getEmailSenderAccount(accountId)
        if (!senderAccount) {
          return NextResponse.json(
            { success: false, error: 'Không tìm thấy tài khoản email.' },
            { status: 404 },
          )
        }
        senderEmailLabel = senderAccount.email
      }

      const sentAt = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      const result = await sendMail({
        to: recipient,
        subject: `[TPS] Kiểm tra ${senderEmailLabel || 'email'} - ${sentAt}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
            <h2 style="color:#a1001f">Kiểm tra hệ thống email thành công</h2>
            <p>Email này được gửi từ màn hình Giám sát Email.</p>
            ${senderEmailLabel ? `<p><strong>Tài khoản gửi:</strong> ${senderEmailLabel}</p>` : ''}
            <p><strong>Người thực hiện:</strong> ${gate.sessionEmail}</p>
            <p><strong>Thời điểm:</strong> ${sentAt}</p>
          </div>
        `,
        emailType: 'system_test',
        source: 'app/api/admin/email-monitor',
        senderAccountId: accountId,
        metadata: {
          initiatedBy: gate.sessionEmail,
          ...(accountId ? { testAccountId: accountId } : {}),
        },
      })

      if (!result.sent) {
        return NextResponse.json(
          {
            success: false,
            error:
              result.warning === 'GMAIL_NOT_CONFIGURED'
                ? 'Chưa cấu hình tài khoản Gmail hoạt động.'
                : result.warning || 'Không gửi được email thử.',
            result,
          },
          { status: 503 },
        )
      }

      return NextResponse.json({ success: true, result })
    }

    return NextResponse.json(
      { success: false, error: 'Action không hợp lệ.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[admin/email-monitor] POST failed:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Không thực hiện được kiểm tra email.',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireBearerSuperAdminMutation(request)
  if (!gate.ok) return gate.response

  try {
    await waitForMigrations()
    const accountIdParam = request.nextUrl.searchParams.get('accountId')
    if (accountIdParam) {
      const accountId = toInteger(accountIdParam)
      if (accountId <= 0) {
        return NextResponse.json(
          { success: false, error: 'accountId không hợp lệ.' },
          { status: 400 },
        )
      }
      const result = await deleteDatabaseEmailSenderAccount(accountId)
      if (!result.deleted) {
        const message = 'Không tìm thấy tài khoản email.'
        return NextResponse.json(
          { success: false, error: message },
          { status: 404 },
        )
      }
      return NextResponse.json({ success: true, deletedAccountId: accountId })
    }

    const settingsResult = await pool.query(
      `SELECT retention_days FROM email_monitor_settings WHERE id = 1`,
    )
    const retentionDays = Math.min(
      730,
      Math.max(7, toInteger(settingsResult.rows[0]?.retention_days || 90)),
    )
    const result = await pool.query(
      `DELETE FROM email_delivery_logs
      WHERE created_at < NOW() - make_interval(days => $1)
      RETURNING id`,
      [retentionDays],
    )

    return NextResponse.json({
      success: true,
      deleted: result.rowCount || 0,
      retentionDays,
    })
  } catch (error) {
    console.error('[admin/email-monitor] DELETE failed:', error)
    return NextResponse.json(
      { success: false, error: 'Không dọn được log email.' },
      { status: 500 },
    )
  }
}
