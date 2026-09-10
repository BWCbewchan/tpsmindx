import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import {
  ALL_SUBJECT_OPTIONS,
  CASE_RESULT_OPTIONS,
  SCORE_COLUMNS,
  SUBJECT_OPTIONS,
  TRACKS,
  calculateAverageScore,
  getRequiredScoreKeys,
  resolveRubricType,
  type CaseResult,
  type ScoreMap,
  type TrialTrack,
} from '@/lib/trial-checkout-rubrics'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_TRACKS = new Set(TRACKS.map((track) => track.value))
const VALID_SUBJECTS = new Set(ALL_SUBJECT_OPTIONS)
const VALID_CASE_RESULTS = new Set<string>(CASE_RESULT_OPTIONS.map((item) => item.value))

type SubmissionBody = {
  teacherName?: unknown
  center?: unknown
  salesOwner?: unknown
  studentName?: unknown
  studentAge?: unknown
  trialDate?: unknown
  track?: unknown
  subject?: unknown
  scores?: Record<string, unknown>
  generalComment?: unknown
  evidenceLink?: unknown
  caseResult?: unknown
  note?: unknown
}

function textValue(value: unknown, maxLength = 300): string {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength)
}

function parseIsoDate(value: unknown): string | null {
  const text = textValue(value, 30)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) return text
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3]
    const iso = `${year}-${month}-${day}`
    const date = new Date(`${iso}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) {
      const parsedDay = Number.parseInt(day, 10)
      const parsedMonth = Number.parseInt(month, 10)
      const parsedYear = Number.parseInt(year, 10)
      if (
        date.getUTCDate() === parsedDay &&
        date.getUTCMonth() + 1 === parsedMonth &&
        date.getUTCFullYear() === parsedYear
      ) {
        return iso
      }
    }
  }

  return null
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseScore(value: unknown): number | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 1 || number > 5) return null
  return Math.round(number * 100) / 100
}

function getScorePayload(input: Record<string, unknown> | undefined): ScoreMap {
  const scores: ScoreMap = {}
  for (const key of SCORE_COLUMNS) {
    const score = parseScore(input?.[key])
    if (score != null) scores[key] = score
  }
  return scores
}

async function lookupTeacher(email: string) {
  const emailUser = email.split('@')[0] || email
  const result = await pool.query(
    `SELECT
        code,
        COALESCE(
          NULLIF(TRIM(full_name), ''),
          NULLIF(TRIM("Full name"), '')
        ) AS teacher_name
     FROM teachers
     WHERE LOWER(TRIM(COALESCE(work_email, ''))) = $1
        OR LOWER(TRIM(COALESCE("Work email", ''))) = $1
        OR LOWER(TRIM(COALESCE(personal_email, ''))) = $1
        OR LOWER(TRIM(COALESCE(user_name, ''))) = $2
        OR LOWER(TRIM(COALESCE("User name", ''))) = $2
     LIMIT 1`,
    [email, emailUser],
  )

  return result.rows[0] || null
}

function addWhere(
  clauses: string[],
  values: unknown[],
  clause: string,
  value: unknown,
) {
  values.push(value)
  clauses.push(clause.replace('?', `$${values.length}`))
}

function publicCheckoutUrl(request: NextRequest, token: string): string {
  return new URL(`/public/checkout/${token}`, request.nextUrl.origin).toString()
}

const CANONICAL_CENTERS = [
  '3 tháng 2',
  'Hải Thượng Lãn Ông',
  'Him Lam ( Nguyễn Thị Thập )',
  'Lê Văn Việt',
  'Lũy Bán Bích',
  'Mizuki',
  'Nguyễn Duy Trinh',
  'Nguyễn Xí',
  'Phạm Ngũ Lão',
  'Phạm Văn Đồng',
  'Phan Văn Trị',
  'Phan Xích Long',
  'Phú Mỹ Hưng',
  'Quang Trung',
  'Song Hành',
  'Tây Thạnh',
  'Tên Lửa',
  'Tô Ký',
  'Trường Chinh',
  'Vinhome Central Park (Bình Thạnh)',
  'Vinhome Grand Park (Q9-Thủ Đức)',
]

function normalizeCenter(name: unknown): string {
  const raw = String(name ?? '').trim()
  if (!raw) return ''
  for (const c of CANONICAL_CENTERS) {
    if (raw.toLowerCase() === c.toLowerCase()) return c
  }
  for (const c of CANONICAL_CENTERS) {
    if (raw.toLowerCase().includes(c.toLowerCase())) return c
  }
  if (/3\s*tháng\s*2|3\/2/i.test(raw)) return '3 tháng 2'
  if (/nguyễn\s*thị\s*thập|him\s*lam/i.test(raw)) return 'Him Lam ( Nguyễn Thị Thập )'
  if (/grand\s*park/i.test(raw)) return 'Vinhome Grand Park (Q9-Thủ Đức)'
  if (/central\s*park/i.test(raw)) return 'Vinhome Central Park (Bình Thạnh)'
  return raw.replace(/^(HCM|HN|ĐN|BD)\s*-\s*(\d+[A-Z]*\s*)?/i, '').trim() || raw
}

function centerFilterVariants(name: unknown): string[] {
  const raw = textValue(name, 160)
  const normalized = normalizeCenter(raw)
  return Array.from(new Set([raw, normalized].map((value) => value.trim()).filter(Boolean)))
}

function formatTimestampRaw(date: Date): string {
  const gmt7 = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  const m = gmt7.getUTCMonth() + 1
  const d = gmt7.getUTCDate()
  const y = gmt7.getUTCFullYear()
  let h = gmt7.getUTCHours()
  const min = String(gmt7.getUTCMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${m}/${d}/${y} ${h}:${min} ${ampm}`
}

function formatTrialDateRaw(trialDate: string | null, trialDateRaw?: string): string {
  if (trialDateRaw && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trialDateRaw.trim())) {
    const [d, m, y] = trialDateRaw.trim().split('/')
    return `${Number(d)}/${Number(m)}/${y}`
  }
  if (trialDate && /^\d{4}-\d{2}-\d{2}$/.test(trialDate)) {
    const [y, m, d] = trialDate.split('-')
    return `${Number(d)}/${Number(m)}/${y}`
  }
  return trialDateRaw || trialDate || ''
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 50), 200)
    const clauses: string[] = []
    const values: unknown[] = []

    const teacher = textValue(searchParams.get('teacher'), 120)
    if (teacher) {
      addWhere(
        clauses,
        values,
        `LOWER(trial_teacher_name) LIKE '%' || LOWER(?) || '%'`,
        teacher,
      )
    }

    const student = textValue(searchParams.get('student'), 120)
    if (student) {
      addWhere(
        clauses,
        values,
        `LOWER(student_name) LIKE '%' || LOWER(?) || '%'`,
        student,
      )
    }

    const center = textValue(searchParams.get('center'), 160)
    if (center) {
      const variants = centerFilterVariants(center)
      values.push(variants)
      const centerParam = `$${values.length}`
      clauses.push(`(
        NULLIF(TRIM(COALESCE(center_name, '')), '') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(${centerParam}::text[]) AS selected_center(value)
          WHERE NULLIF(TRIM(selected_center.value), '') IS NOT NULL
            AND (
              LOWER(TRIM(center_name)) = LOWER(TRIM(selected_center.value))
              OR LOWER(TRIM(selected_center.value)) LIKE '%' || LOWER(TRIM(center_name)) || '%'
              OR LOWER(TRIM(center_name)) LIKE '%' || LOWER(TRIM(selected_center.value)) || '%'
            )
        )
      )`)
    }

    const track = textValue(searchParams.get('track'), 40)
    if (track && VALID_TRACKS.has(track as TrialTrack)) {
      addWhere(clauses, values, 'track = ?', track)
    }

    const subject = textValue(searchParams.get('subject'), 120)
    if (subject) {
      addWhere(clauses, values, 'LOWER(trial_subject) = LOWER(?)', subject)
    }

    const fromDate = parseIsoDate(searchParams.get('fromDate'))
    if (fromDate) {
      addWhere(clauses, values, 'trial_date >= ?::date', fromDate)
    }

    const toDate = parseIsoDate(searchParams.get('toDate'))
    if (toDate) {
      addWhere(clauses, values, 'trial_date <= ?::date', toDate)
    }

    const sortParam = textValue(searchParams.get('sort'), 40) || 'created_desc'
    let orderByClause = 'ORDER BY COALESCE(timestamp_at, imported_at::timestamp) DESC NULLS LAST, raw_id DESC'
    if (sortParam === 'created_asc') {
      orderByClause = 'ORDER BY COALESCE(timestamp_at, imported_at::timestamp) ASC NULLS LAST, raw_id ASC'
    } else if (sortParam === 'trial_date_desc') {
      orderByClause = 'ORDER BY trial_date DESC NULLS LAST, raw_id DESC'
    } else if (sortParam === 'trial_date_asc') {
      orderByClause = 'ORDER BY trial_date ASC NULLS LAST, raw_id ASC'
    } else if (sortParam === 'score_desc') {
      orderByClause = 'ORDER BY total_score DESC NULLS LAST, raw_id DESC'
    } else if (sortParam === 'score_asc') {
      orderByClause = 'ORDER BY total_score ASC NULLS LAST, raw_id ASC'
    } else if (sortParam === 'student_name_asc') {
      orderByClause = 'ORDER BY student_name ASC NULLS LAST, raw_id DESC'
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    values.push(limit)

    const result = await pool.query(
      `SELECT
          raw_id::integer AS id,
          COALESCE(timestamp_at, imported_at::timestamp) AS submitted_at,
          raw_payload->>'submittedByEmail' AS teacher_email,
          raw_payload->>'teacherCode' AS teacher_code,
          trial_teacher_name,
          sales_owner_name,
          student_name,
          student_age_label,
          trial_date,
          track,
          trial_subject,
          center_name,
          total_score,
          case_result,
          general_comment,
          evidence_link,
          COALESCE(
            raw_payload->>'rubricType',
            CASE
              WHEN LOWER(TRIM(COALESCE(track, ''))) = 'art' THEN 'art'
              WHEN LOWER(TRIM(COALESCE(track, ''))) = 'robotics' THEN 'robotics4'
              WHEN LOWER(TRIM(COALESCE(trial_subject, ''))) IN ('rob4b', 'lego 6+', 'preb', 'armb', 'semib') THEN 'robotics4'
              ELSE 'common'
            END
          ) AS rubric_type,
          raw_payload->>'publicToken' AS public_token,
          COUNT(*) OVER()::integer AS total_count
       FROM trial_checkout_raw
       ${whereClause}
       ${orderByClause}
       LIMIT $${values.length}`,
      values,
    )

    return NextResponse.json({
      success: true,
      data: {
        rows: result.rows,
        total: result.rows[0]?.total_count || 0,
      },
    })
  } catch (error) {
    console.error('Error listing checkout forms:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải danh sách checkout',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as SubmissionBody
    const track = textValue(body.track, 40) as TrialTrack
    const subject = textValue(body.subject, 120)
    const center = textValue(body.center, 160)
    const salesOwner = textValue(body.salesOwner, 160)
    const studentName = textValue(body.studentName, 160)
    const studentAge = textValue(body.studentAge, 80)
    const trialDateRaw = textValue(body.trialDate, 40)
    const trialDate = parseIsoDate(body.trialDate)
    const generalComment = textValue(body.generalComment, 5000)
    const note = textValue(body.note, 2000)
    const caseResult = textValue(body.caseResult, 40) as CaseResult

    if (!VALID_TRACKS.has(track)) {
      return NextResponse.json({ success: false, error: 'Khối trải nghiệm không hợp lệ' }, { status: 400 })
    }
    if (!VALID_SUBJECTS.has(subject) || !SUBJECT_OPTIONS[track].includes(subject)) {
      return NextResponse.json({ success: false, error: 'Môn trải nghiệm không hợp lệ' }, { status: 400 })
    }
    if (!center || !salesOwner || !studentName || !studentAge || !trialDate) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin Phase 1' }, { status: 400 })
    }
    if (!generalComment) {
      return NextResponse.json({ success: false, error: 'Thiếu nhận xét chung' }, { status: 400 })
    }
    if (!VALID_CASE_RESULTS.has(caseResult)) {
      return NextResponse.json({ success: false, error: 'Thông tin chốt case không hợp lệ' }, { status: 400 })
    }

    const scorePayload = getScorePayload(body.scores)
    const requiredScoreKeys = getRequiredScoreKeys(track, subject)
    const missingScoreKeys = requiredScoreKeys.filter((key) => scorePayload[key] == null)
    if (missingScoreKeys.length > 0) {
      return NextResponse.json({ success: false, error: 'Thiếu điểm Phase 2' }, { status: 400 })
    }

    const totalScore = calculateAverageScore(scorePayload, requiredScoreKeys)
    if (totalScore == null) {
      return NextResponse.json({ success: false, error: 'Không thể tính tổng điểm' }, { status: 400 })
    }

    const email = auth.sessionEmail.trim().toLowerCase()
    const emailUser = email.split('@')[0] || email
    const teacher = await lookupTeacher(email)
    const teacherName =
      textValue(body.teacherName, 160) ||
      textValue(teacher?.teacher_name, 160) ||
      emailUser
    const teacherCode = textValue(teacher?.code, 80) || null
    const rubricType = resolveRubricType(track, subject)

    const scoreValues = SCORE_COLUMNS.map((column) => scorePayload[column] ?? null)
    const submittedAt = new Date()
    const normalizedCenter = normalizeCenter(center)
    const timestampRaw = formatTimestampRaw(submittedAt)
    const trialDateRawFormatted = formatTrialDateRaw(trialDate, trialDateRaw)
    const sourceFile = 'Data_trial_raw.xlsx'
    const sourceSheet = 'Sheet1'
    const columns = [
      'raw_id',
      'source_file',
      'source_sheet',
      'source_row_number',
      'timestamp_raw',
      'timestamp_at',
      'trial_teacher_name',
      'sales_owner_name',
      'student_name',
      'student_age_label',
      'trial_date_raw',
      'trial_date',
      'track',
      'trial_subject',
      'center_name',
      ...SCORE_COLUMNS,
      'total_score',
      'case_result',
      'general_comment',
      'evidence_link',
      'raw_payload',
    ]

    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await client.query('LOCK TABLE trial_checkout_raw IN SHARE ROW EXCLUSIVE MODE')

      const idResult = await client.query(
        'SELECT COALESCE(MAX(raw_id), 0)::bigint + 1 AS next_raw_id FROM trial_checkout_raw',
      )
      const rawId = Number(idResult.rows[0]?.next_raw_id || 1)
      const sourceRowNumber = Math.max(rawId - 197, 2)
      const publicToken = String(rawId)
      const publicUrl = publicCheckoutUrl(request, publicToken)

      const rawPayload: Record<string, unknown> = {
        Id: String(rawId),
        Timestamp: timestampRaw,
        'Tên giáo viên Trial': teacherName,
        'Tên sale phụ trách': salesOwner,
        'Họ tên học viên': studentName,
        Tuổi: studentAge,
        'Ngày trải nghiệm': trialDateRawFormatted,
        Khối: track,
        'Môn trải nghiệm': subject,
        'Cơ sở': normalizedCenter,
        HT1: scorePayload.ht1 != null ? Number(scorePayload.ht1).toFixed(2) : null,
        HT2: scorePayload.ht2 != null ? Number(scorePayload.ht2).toFixed(2) : null,
        HT3: scorePayload.ht3 != null ? Number(scorePayload.ht3).toFixed(2) : null,
        ST1: scorePayload.st1 != null ? Number(scorePayload.st1).toFixed(2) : null,
        ST2: scorePayload.st2 != null ? Number(scorePayload.st2).toFixed(2) : null,
        LG1: scorePayload.lg1 != null ? Number(scorePayload.lg1).toFixed(2) : null,
        LG2: scorePayload.lg2 != null ? Number(scorePayload.lg2).toFixed(2) : null,
        GT1: scorePayload.gt1 != null ? Number(scorePayload.gt1).toFixed(2) : null,
        GT2: scorePayload.gt2 != null ? Number(scorePayload.gt2).toFixed(2) : null,
        'ROB4B-1': scorePayload.rob4b_1 != null ? Number(scorePayload.rob4b_1).toFixed(2) : null,
        'ROB4B-2': scorePayload.rob4b_2 != null ? Number(scorePayload.rob4b_2).toFixed(2) : null,
        'ROB4B-3': scorePayload.rob4b_3 != null ? Number(scorePayload.rob4b_3).toFixed(2) : null,
        'ROB4B-4': scorePayload.rob4b_4 != null ? Number(scorePayload.rob4b_4).toFixed(2) : null,
        'ART4+1': scorePayload.art4p_1 != null ? Number(scorePayload.art4p_1).toFixed(2) : null,
        'ART4+2': scorePayload.art4p_2 != null ? Number(scorePayload.art4p_2).toFixed(2) : null,
        'ART4+3': scorePayload.art4p_3 != null ? Number(scorePayload.art4p_3).toFixed(2) : null,
        'ART4+4': scorePayload.art4p_4 != null ? Number(scorePayload.art4p_4).toFixed(2) : null,
        'ART4+5': scorePayload.art4p_5 != null ? Number(scorePayload.art4p_5).toFixed(2) : null,
        'Tổng điểm': totalScore != null ? String(totalScore) : null,
        'Chốt case': caseResult,
        'Nhận xét chung': generalComment,
        'Định hướng thêm': note || null,
        'Lưu ý thêm': note || null,
        Link: publicUrl,
        // Internal metadata
        source: sourceFile,
        submittedByEmail: email,
        teacherCode,
        teacherName,
        center: normalizedCenter,
        salesOwner,
        studentName,
        studentAge,
        trialDate,
        trialDateRaw: trialDateRawFormatted,
        track,
        subject,
        scores: scorePayload,
        totalScore,
        generalComment,
        note: note || null,
        specialNote: note || null,
        evidenceLink: publicUrl,
        caseResult,
        rubricType,
        publicToken,
        publicUrl,
        phase1: {
          teacherName,
          center: normalizedCenter,
          salesOwner,
          studentName,
          studentAge,
          trialDate,
          trialDateRaw: trialDateRawFormatted,
          track,
          subject,
        },
        scoring: {
          rubricType,
          scores: scorePayload,
          totalScore,
        },
      }

      const values = [
        rawId,
        sourceFile,
        sourceSheet,
        sourceRowNumber,
        timestampRaw,
        submittedAt,
        teacherName,
        salesOwner,
        studentName,
        studentAge,
        trialDateRawFormatted,
        trialDate,
        track,
        subject,
        normalizedCenter,
        ...scoreValues,
        totalScore,
        caseResult,
        generalComment,
        publicUrl,
        JSON.stringify(rawPayload),
      ]

      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
      const result = await client.query(
        `INSERT INTO trial_checkout_raw (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING
            raw_id::integer AS id,
            timestamp_at AS submitted_at,
            trial_teacher_name,
            student_name,
            total_score,
            case_result,
            evidence_link`,
        values,
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          ...result.rows[0],
          public_token: publicToken,
          public_url: publicUrl,
        },
      })
    } catch (insertError) {
      await client.query('ROLLBACK')
      throw insertError
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error submitting checkout form:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể gửi form checkout',
      },
      { status: 500 },
    )
  }
}
