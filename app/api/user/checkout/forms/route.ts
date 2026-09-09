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
import { randomUUID } from 'crypto'
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
}

function textValue(value: unknown, maxLength = 300): string {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength)
}

function parseIsoDate(value: unknown): string | null {
  const text = textValue(value, 30)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return text
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
      addWhere(clauses, values, 'center_name = ?', center)
    }

    const track = textValue(searchParams.get('track'), 40)
    if (track && VALID_TRACKS.has(track as TrialTrack)) {
      addWhere(clauses, values, 'track = ?', track)
    }

    const subject = textValue(searchParams.get('subject'), 120)
    if (subject) {
      addWhere(clauses, values, 'trial_subject = ?', subject)
    }

    const fromDate = parseIsoDate(searchParams.get('fromDate'))
    if (fromDate) {
      addWhere(clauses, values, 'trial_date >= ?::date', fromDate)
    }

    const toDate = parseIsoDate(searchParams.get('toDate'))
    if (toDate) {
      addWhere(clauses, values, 'trial_date <= ?::date', toDate)
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
              WHEN LOWER(TRIM(COALESCE(trial_subject, ''))) IN ('rob4b', 'lego 6+') THEN 'robotics4'
              ELSE 'common'
            END
          ) AS rubric_type,
          raw_payload->>'publicToken' AS public_token,
          COUNT(*) OVER()::integer AS total_count
       FROM trial_checkout_raw
       ${whereClause}
       ORDER BY COALESCE(timestamp_at, imported_at::timestamp) DESC NULLS LAST, raw_id DESC
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
    const trialDate = parseIsoDate(body.trialDate)
    const generalComment = textValue(body.generalComment, 5000)
    const evidenceLink = textValue(body.evidenceLink, 800)
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
    if (evidenceLink && !/^https?:\/\//i.test(evidenceLink)) {
      return NextResponse.json({ success: false, error: 'Link minh chứng không hợp lệ' }, { status: 400 })
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
    const publicToken = randomUUID()
    const publicUrl = publicCheckoutUrl(request, publicToken)
    const sourceFile = 'teacher-checkout-form'
    const sourceSheet = 'app/user/checkout/create'
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
    const rawPayload = {
      source: sourceFile,
      submittedByEmail: email,
      teacherCode,
      teacherName,
      center,
      salesOwner,
      studentName,
      studentAge,
      trialDate,
      track,
      subject,
      scores: scorePayload,
      totalScore,
      generalComment,
      evidenceLink: evidenceLink || null,
      caseResult,
      rubricType,
      publicToken,
      publicUrl,
      phase1: {
        teacherName,
        center,
        salesOwner,
        studentName,
        studentAge,
        trialDate,
        track,
        subject,
      },
      scoring: {
        rubricType,
        scores: scorePayload,
        totalScore,
      },
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await client.query('LOCK TABLE trial_checkout_raw IN SHARE ROW EXCLUSIVE MODE')

      const idResult = await client.query(
        'SELECT COALESCE(MAX(raw_id), 0)::bigint + 1 AS next_raw_id FROM trial_checkout_raw',
      )
      const rawId = Number(idResult.rows[0]?.next_raw_id || 1)
      const sourceRowNumber = Math.max(rawId, 2)
      const values = [
        rawId,
        sourceFile,
        sourceSheet,
        sourceRowNumber,
        submittedAt.toISOString(),
        submittedAt,
        teacherName,
        salesOwner,
        studentName,
        studentAge,
        trialDate,
        trialDate,
        track,
        subject,
        center,
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
