import pool from '@/lib/db'
import { createNotification, createNotificationForEveryone } from '@/lib/notification-service'
import {
  exportOriginalCheckCongRowsByKeys,
  type CheckCongRecord,
} from '@/lib/check-cong-service'

export type CheckCongFeedbackStatus = 'pending' | 'approved' | 'rejected'

export type CheckCongFeedback = {
  id: number
  checkKey: string
  teacherEmail: string
  teacherName: string
  username: string
  centre: string
  workType: string
  className: string
  course: string
  courseLine: string
  roleType: string
  slotTime: string
  statusSnapshot: string
  studentCount: number | null
  slotDuration: number
  effectiveDuration: number
  feedbackContent: string
  feedbackStatus: CheckCongFeedbackStatus
  reviewerEmail: string | null
  reviewerNote: string | null
  reviewedAt: string | null
  exportedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CheckCongFeedbackSetting = {
  isOpen: boolean
  opensAt: string | null
  closesAt: string | null
  updatedByEmail: string | null
  updatedAt: string | null
  canSubmit: boolean
}

type StoredCheckCongFeedbackSetting = Omit<CheckCongFeedbackSetting, 'canSubmit'>

const defaultSetting = (): StoredCheckCongFeedbackSetting => ({
  isOpen: false,
  opensAt: null,
  closesAt: null,
  updatedByEmail: null,
  updatedAt: null,
})

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isWithinWindow(setting: StoredCheckCongFeedbackSetting) {
  if (!setting.isOpen) return false
  const now = Date.now()
  const opensAt = setting.opensAt ? new Date(setting.opensAt).getTime() : null
  const closesAt = setting.closesAt ? new Date(setting.closesAt).getTime() : null
  return (opensAt == null || now >= opensAt) && (closesAt == null || now <= closesAt)
}

function withSubmitState(setting: StoredCheckCongFeedbackSetting): CheckCongFeedbackSetting {
  return {
    ...setting,
    canSubmit: isWithinWindow(setting),
  }
}

function formatDeadline(raw: Date | string | null) {
  if (!raw) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(raw))
}

async function waitForMigrationInit() {
  if (!global.migrationInitPromise) return
  await global.migrationInitPromise.catch(() => undefined)
}

async function ensureCheckCongFeedbackTables() {
  await waitForMigrationInit()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS check_cong_feedback_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      is_open BOOLEAN NOT NULL DEFAULT FALSE,
      opens_at TIMESTAMP WITH TIME ZONE,
      closes_at TIMESTAMP WITH TIME ZONE,
      updated_by_email VARCHAR(255),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO check_cong_feedback_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS check_cong_feedbacks (
      id BIGSERIAL PRIMARY KEY,
      check_key VARCHAR(80) NOT NULL,
      teacher_email VARCHAR(255) NOT NULL,
      teacher_name VARCHAR(255),
      username VARCHAR(100),
      centre VARCHAR(100),
      work_type VARCHAR(50),
      class_name TEXT,
      course TEXT,
      course_line TEXT,
      role_type VARCHAR(100),
      slot_time TEXT,
      status_snapshot VARCHAR(50),
      student_count INTEGER,
      slot_duration NUMERIC(8,2),
      effective_duration NUMERIC(8,2),
      feedback_content TEXT NOT NULL,
      feedback_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (feedback_status IN ('pending', 'approved', 'rejected')),
      reviewer_email VARCHAR(255),
      reviewer_note TEXT,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      exported_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(check_key, teacher_email)
    );

    CREATE INDEX IF NOT EXISTS idx_check_cong_feedbacks_status_created
      ON check_cong_feedbacks(feedback_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_check_cong_feedbacks_teacher
      ON check_cong_feedbacks(LOWER(teacher_email), created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_check_cong_feedbacks_check_key
      ON check_cong_feedbacks(check_key);
  `)
}

function toIsoString(value: unknown): string | null {
  if (value == null) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mapSettingRow(
  row: Record<string, unknown> | undefined,
): StoredCheckCongFeedbackSetting {
  if (!row) return defaultSetting()
  return {
    isOpen: Boolean(row.is_open),
    opensAt: toIsoString(row.opens_at),
    closesAt: toIsoString(row.closes_at),
    updatedByEmail:
      row.updated_by_email == null ? null : String(row.updated_by_email),
    updatedAt: toIsoString(row.updated_at),
  }
}

function mapFeedbackRow(row: Record<string, unknown>): CheckCongFeedback {
  return {
    id: Number(row.id),
    checkKey: String(row.check_key ?? ''),
    teacherEmail: String(row.teacher_email ?? ''),
    teacherName: String(row.teacher_name ?? ''),
    username: String(row.username ?? ''),
    centre: String(row.centre ?? ''),
    workType: String(row.work_type ?? ''),
    className: String(row.class_name ?? ''),
    course: String(row.course ?? ''),
    courseLine: String(row.course_line ?? ''),
    roleType: String(row.role_type ?? ''),
    slotTime: String(row.slot_time ?? ''),
    statusSnapshot: String(row.status_snapshot ?? ''),
    studentCount: row.student_count == null ? null : Number(row.student_count),
    slotDuration: Number(row.slot_duration ?? 0),
    effectiveDuration: Number(row.effective_duration ?? 0),
    feedbackContent: String(row.feedback_content ?? ''),
    feedbackStatus: String(row.feedback_status || 'pending') as CheckCongFeedbackStatus,
    reviewerEmail: row.reviewer_email == null ? null : String(row.reviewer_email),
    reviewerNote: row.reviewer_note == null ? null : String(row.reviewer_note),
    reviewedAt: toIsoString(row.reviewed_at),
    exportedAt: toIsoString(row.exported_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  }
}

async function readFeedbackSetting(): Promise<StoredCheckCongFeedbackSetting> {
  await ensureCheckCongFeedbackTables()
  const result = await pool.query(
    `SELECT is_open, opens_at, closes_at, updated_by_email, updated_at
     FROM check_cong_feedback_settings
     WHERE id = 1`,
  )
  return mapSettingRow(result.rows[0])
}

async function closeExpiredFeedbackWindow(): Promise<StoredCheckCongFeedbackSetting> {
  await ensureCheckCongFeedbackTables()
  const expiredOpen = await pool.query(
    `
    UPDATE check_cong_feedback_settings
    SET is_open = FALSE,
        opens_at = NULL,
        closes_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
      AND is_open IS TRUE
      AND closes_at IS NOT NULL
      AND closes_at < CURRENT_TIMESTAMP
    RETURNING *
    `,
  )

  if (expiredOpen.rows.length > 0) {
    await Promise.allSettled([
      notifyCheckCongTeachersFeedbackClosed(),
      notifyCheckCongReviewersForClosing(),
    ])
  } else {
    await pool.query(
      `
      UPDATE check_cong_feedback_settings
      SET opens_at = NULL,
          closes_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
        AND is_open IS FALSE
        AND closes_at IS NOT NULL
        AND closes_at < CURRENT_TIMESTAMP
      `,
    )
  }

  return readFeedbackSetting()
}

function getFeedbackMonth(feedback: CheckCongFeedback): string {
  const raw = feedback.slotTime.trim()
  const iso = raw.match(/^(\d{4})-(\d{1,2})-/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}`

  const englishMonths: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  }
  const english = raw.match(/^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+\d{1,2}\s+(\d{4})/)
  if (english) {
    const month = englishMonths[english[1].toLowerCase()]
    if (month) return `${english[2]}-${month}`
  }

  const viDate = raw.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (viDate) return `${viDate[3]}-${viDate[2].padStart(2, '0')}`

  return feedback.createdAt.slice(0, 7)
}

export async function getCheckCongFeedbackSetting(): Promise<CheckCongFeedbackSetting> {
  const setting = await closeExpiredFeedbackWindow()
  return withSubmitState(setting)
}

export async function updateCheckCongFeedbackSetting(input: {
  isOpen: boolean
  opensAt?: string | null
  closesAt?: string | null
  updatedByEmail: string
}) {
  const previous = await closeExpiredFeedbackWindow()
  const result = await pool.query(
    `
    UPDATE check_cong_feedback_settings
    SET is_open = $1,
        opens_at = $2,
        closes_at = $3,
        updated_by_email = $4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *
    `,
    [
      input.isOpen,
      input.isOpen ? input.opensAt || null : null,
      input.isOpen ? input.closesAt || null : null,
      normalizeEmail(input.updatedByEmail),
    ],
  )

  const setting = withSubmitState(mapSettingRow(result.rows[0]))
  if (setting.isOpen && !previous.isOpen) {
    await notifyCheckCongTeachersFeedbackOpened(setting.closesAt)
  }
  if (previous.isOpen && !setting.isOpen) {
    await Promise.allSettled([
      notifyCheckCongTeachersFeedbackClosed(),
      notifyCheckCongReviewersForClosing(),
    ])
  }

  return setting
}

async function notifyCheckCongTeachersFeedbackOpened(closesAt: Date | string | null) {
  const deadline = closesAt ? ` Hạn phản hồi đến ${formatDeadline(closesAt)}.` : ''

  await createNotificationForEveryone({
    title: 'Đợt "Phản hồi công" đã mở',
    content: `Đợt "Phản hồi công" đã mở.${deadline}`,
    type: 'check_cong_feedback_open',
    link: '/user/thong-tin-giao-vien?tab=checkCongFeedback',
  })
}

async function notifyCheckCongTeachersFeedbackClosed() {
  await createNotificationForEveryone({
    title: 'Đợt "Phản hồi công" đã đóng',
    content: 'Đợt "Phản hồi công" đã đóng. Bạn có thể theo dõi kết quả duyệt trong tab Phản hồi công.',
    type: 'check_cong_feedback_closed',
    link: '/user/thong-tin-giao-vien?tab=checkCongFeedback',
  })
}

export async function getFeedbacksForTeacher(email: string) {
  await ensureCheckCongFeedbackTables()
  const result = await pool.query(
    `
    SELECT *
    FROM check_cong_feedbacks
    WHERE LOWER(TRIM(teacher_email)) = LOWER(TRIM($1))
    ORDER BY created_at DESC
    `,
    [email],
  )
  return result.rows.map(mapFeedbackRow)
}

export async function getFeedbacksForKeys(checkKeys: string[]) {
  const keys = Array.from(new Set(checkKeys.filter(Boolean)))
  if (keys.length === 0) return new Map<string, CheckCongFeedback>()

  await ensureCheckCongFeedbackTables()
  const result = await pool.query(
    `
    SELECT *
    FROM check_cong_feedbacks
    WHERE check_key = ANY($1::text[])
    ORDER BY updated_at DESC
    `,
    [keys],
  )
  const feedbacks = new Map<string, CheckCongFeedback>()
  for (const row of result.rows) {
    const feedback = mapFeedbackRow(row)
    if (!feedbacks.has(feedback.checkKey)) {
      feedbacks.set(feedback.checkKey, feedback)
    }
  }
  return feedbacks
}

export async function submitCheckCongFeedback(input: {
  record: CheckCongRecord
  teacherEmail: string
  content: string
}) {
  if (input.record.status !== 'UNCHECKED') {
    throw new Error('Chỉ phản hồi được các ca Unchecked')
  }

  const setting = await getCheckCongFeedbackSetting()
  if (!setting.canSubmit) {
    throw new Error('Hiện chưa mở thời gian phản hồi công')
  }

  await ensureCheckCongFeedbackTables()
  const normalizedEmail = normalizeEmail(input.teacherEmail)
  const result = await pool.query(
    `
    INSERT INTO check_cong_feedbacks (
      check_key,
      teacher_email,
      teacher_name,
      username,
      centre,
      work_type,
      class_name,
      course,
      course_line,
      role_type,
      slot_time,
      status_snapshot,
      student_count,
      slot_duration,
      effective_duration,
      feedback_content,
      feedback_status,
      reviewer_email,
      reviewer_note,
      reviewed_at,
      exported_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, 'pending', NULL, NULL, NULL, NULL
    )
    ON CONFLICT (check_key, teacher_email)
    DO UPDATE SET
      teacher_name = EXCLUDED.teacher_name,
      username = EXCLUDED.username,
      centre = EXCLUDED.centre,
      work_type = EXCLUDED.work_type,
      class_name = EXCLUDED.class_name,
      course = EXCLUDED.course,
      course_line = EXCLUDED.course_line,
      role_type = EXCLUDED.role_type,
      slot_time = EXCLUDED.slot_time,
      status_snapshot = EXCLUDED.status_snapshot,
      student_count = EXCLUDED.student_count,
      slot_duration = EXCLUDED.slot_duration,
      effective_duration = EXCLUDED.effective_duration,
      feedback_content = EXCLUDED.feedback_content,
      feedback_status = 'pending',
      reviewer_email = NULL,
      reviewer_note = NULL,
      reviewed_at = NULL,
      exported_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [
      input.record.checkKey,
      normalizedEmail,
      input.record.teacherName,
      input.record.username,
      input.record.centre,
      input.record.type,
      input.record.className,
      input.record.course,
      input.record.courseLine,
      input.record.roleType,
      input.record.slotTime,
      input.record.status,
      input.record.studentCount,
      input.record.slotDuration,
      input.record.effectiveDuration,
      input.content.trim(),
    ],
  )

  return mapFeedbackRow(result.rows[0])
}

async function notifyCheckCongReviewersForClosing() {
  const reviewers = await pool.query(
    `SELECT DISTINCT LOWER(TRIM(email)) AS email
     FROM app_users
     WHERE is_active IS TRUE
       AND role IN ('super_admin', 'admin', 'manager')
       AND NULLIF(TRIM(email), '') IS NOT NULL`,
  )
  await Promise.allSettled(
    reviewers.rows.map((row) =>
      createNotification({
        recipientEmail: String(row.email),
        title: 'Kiểm tra phản hồi công chung',
        content: 'Đợt "Phản hồi công" đã đóng. Vui lòng kiểm tra và duyệt các phản hồi công đang Pending.',
        type: 'check_cong_feedback_review_batch',
        link: '/admin/check-cong?tab=feedback',
      }),
    ),
  )
}

export async function listCheckCongFeedbacks(input: {
  status?: string
  month?: string
}) {
  await ensureCheckCongFeedbackTables()
  const values: unknown[] = []
  const where: string[] = []
  if (input.status && input.status !== 'all') {
    values.push(input.status)
    where.push(`feedback_status = $${values.length}`)
  }

  const result = await pool.query(
    `
    SELECT *
    FROM check_cong_feedbacks
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT 1000
    `,
    values,
  )

  return result.rows
    .map(mapFeedbackRow)
    .filter((feedback) => {
      if (input.status && input.status !== 'all' && feedback.feedbackStatus !== input.status) {
        return false
      }
      if (input.month && /^\d{4}-\d{2}$/.test(input.month)) {
        return getFeedbackMonth(feedback) === input.month
      }
      return true
    })
    .slice(0, 500)
}

export async function reviewCheckCongFeedback(input: {
  id: number
  status: 'approved' | 'rejected'
  reviewerEmail: string
  reviewerNote?: string
}) {
  await ensureCheckCongFeedbackTables()
  const result = await pool.query(
    `
    UPDATE check_cong_feedbacks
    SET feedback_status = $2,
        reviewer_email = $3,
        reviewer_note = $4,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      input.id,
      input.status,
      normalizeEmail(input.reviewerEmail),
      input.reviewerNote?.trim() || null,
    ],
  )

  if (result.rows.length === 0) throw new Error('Không tìm thấy phản hồi')
  const feedback = mapFeedbackRow(result.rows[0])

  await createNotification({
    recipientEmail: feedback.teacherEmail,
    title:
      input.status === 'approved'
        ? 'Đơn phản hồi công đã được duyệt'
        : 'Đơn phản hồi công chưa được duyệt',
    content:
      input.status === 'approved'
        ? 'Đơn phản hồi công của bạn đã được duyệt.'
        : input.reviewerNote?.trim() || 'Đơn phản hồi công của bạn chưa được duyệt.',
    type: 'check_cong_feedback_reviewed',
    link: '/user/thong-tin-giao-vien?tab=checkCongFeedback',
  })
  return feedback
}

export async function exportApprovedCheckCongFeedbackCsv() {
  const rows = await listCheckCongFeedbacks({ status: 'approved' })
  const pendingExport = rows.filter((row) => !row.exportedAt)
  const exported = await exportOriginalCheckCongRowsByKeys(
    pendingExport.map((row) => row.checkKey),
  )

  if (pendingExport.length > 0) {
    await pool.query(
      `
      UPDATE check_cong_feedbacks
      SET exported_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1::bigint[])
      `,
      [pendingExport.map((row) => row.id)],
    )
  }

  return { csv: exported.csv, count: exported.count }
}
