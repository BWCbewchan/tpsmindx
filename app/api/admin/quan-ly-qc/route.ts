import {
  requireBearerDbRoles,
  requireBearerDbRolesMutation,
} from '@/lib/auth-server'
import { getAccessibleCenters } from '@/lib/center-access'
import pool from '@/lib/db'
import { fetchQCTemplates, findQCTemplate } from '@/lib/qc-templates'
import { getQCWindowInfo } from '@/lib/qc-time-window'
import { NextRequest, NextResponse } from 'next/server'

type AccessibleCenter = {
  id: number
  full_name: string
  short_code: string | null
  region: string | null
}

type QCAnswerInput = {
  criterionId?: unknown
  optionId?: unknown
  optionIds?: unknown
  note?: unknown
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function buildCenterKeys(centers: AccessibleCenter[]): Set<string> {
  const keys = new Set<string>()
  centers.forEach((center) => {
    ;[center.id, center.short_code, center.full_name].forEach((value) => {
      const key = normalizeKey(value)
      if (key) keys.add(key)
    })
  })
  return keys
}

function centerIsAccessible(
  classCenterCandidates: unknown[],
  allowedKeys: Set<string> | null,
) {
  if (!allowedKeys) return true
  const candidates = classCenterCandidates.map(normalizeKey).filter(Boolean)
  return candidates.some((candidate) => {
    if (allowedKeys.has(candidate)) return true
    for (const allowed of allowedKeys) {
      if (candidate.includes(allowed) || allowed.includes(candidate)) return true
    }
    return false
  })
}

function toText(value: unknown, maxLength = 5000): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

function normalizeDate(value: unknown): string | null {
  const text = toText(value, 40)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function normalizeOptionIds(answer: QCAnswerInput | undefined): string[] {
  if (!answer) return []
  if (Array.isArray(answer.optionIds)) {
    return answer.optionIds.map((value) => toText(value, 300)).filter(Boolean)
  }
  const optionId = toText(answer.optionId, 300)
  return optionId ? [optionId] : []
}

function normalizeTeacherAccount(value: unknown) {
  const account = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    id: toText(account.id, 120),
    fullName: toText(account.fullName, 500),
    email: toText(account.email, 255),
    username: toText(account.username, 255),
    code: toText(account.code, 120),
  }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, [
      'super_admin',
      'admin',
      'manager',
    ])
    if (!gate.ok) return gate.response

    const { searchParams } = request.nextUrl
    const requestedLimit = Number(searchParams.get('limit') || 200) || 200
    const limit = Math.min(
      1000,
      Math.max(1, requestedLimit),
    )
    const q = toText(searchParams.get('q'), 120).toLowerCase()
    const emailNorm = (gate.sessionEmail || '').toLowerCase()
    const isSuperOrAdmin =
      gate.role === 'super_admin' ||
      gate.role === 'admin' ||
      emailNorm.includes('hoteaching') ||
      emailNorm.includes('hr-teaching')
    const accessibleCenters =
      isSuperOrAdmin ? null : await getAccessibleCenters(gate.sessionEmail)
    const allowedKeys =
      isSuperOrAdmin
        ? null
        : buildCenterKeys((accessibleCenters ?? []) as AccessibleCenter[])

    const values: unknown[] = []
    const conditions: string[] = []
    if (q) {
      values.push(`%${q}%`)
      conditions.push(`(
        LOWER(q.class_name) LIKE $${values.length}
        OR LOWER(q.class_code) LIKE $${values.length}
        OR LOWER(q.teacher_name) LIKE $${values.length}
        OR LOWER(q.center_name) LIKE $${values.length}
        OR LOWER(q.created_by_email) LIKE $${values.length}
        OR LOWER(u.display_name) LIKE $${values.length}
      )`)
    }
    const sqlLimit = isSuperOrAdmin ? limit : Math.min(1000, limit * 5)
    values.push(sqlLimit)

    const result = await pool.query(
      `
      SELECT
        q.id,
        q.template_key,
        q.template_title,
        q.class_lms_id,
        q.class_code,
        q.class_name,
        q.center_name,
        q.teacher_name,
        q.teacher_rank,
        q.assistant_name,
        q.student_count,
        q.session_index,
        q.session_date,
        q.total_score,
        q.max_score,
        q.result_label,
        q.general_note,
        q.signed,
        q.criteria_snapshot,
        q.answers,
        q.created_by_email,
        COALESCE(u.display_name, q.created_by_email) AS created_by_name,
        q.created_at
      FROM quan_ly_qc q
      LEFT JOIN app_users u ON LOWER(u.email) = LOWER(q.created_by_email)
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY q.created_at DESC
      LIMIT $${values.length}
      `,
      values,
    )
    const rows =
      isSuperOrAdmin
        ? result.rows
        : result.rows.filter((row) =>
            (row.created_by_email &&
              row.created_by_email.toLowerCase() === gate.sessionEmail.toLowerCase()) ||
            centerIsAccessible([row.center_name], allowedKeys),
          )
    const records = rows.slice(0, limit)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthlyResult = await pool.query(
      `
      SELECT COUNT(*)::int AS completed
      FROM quan_ly_qc
      WHERE LOWER(created_by_email) = LOWER($1)
        AND created_at >= $2
      `,
      [gate.sessionEmail, monthStart.toISOString()],
    )
    const monthlyTarget = 8
    const monthlyCompleted = Number(monthlyResult.rows[0]?.completed ?? 0)

    return NextResponse.json({
      success: true,
      records,
      count: records.length,
      isSuperAdmin: isSuperOrAdmin,
      userRole: gate.role,
      userEmail: gate.sessionEmail,
      monthlySummary: {
        target: monthlyTarget,
        completed: monthlyCompleted,
        remaining: Math.max(0, monthlyTarget - monthlyCompleted),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải phiếu QC'
    console.error('[quan-ly-qc] GET error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireBearerDbRolesMutation(request, [
      'super_admin',
      'admin',
      'manager',
    ])
    if (!gate.ok) return gate.response

    const body = await request.json().catch(() => ({}))
    const classInfo = body?.classInfo ?? {}
    const sessionInfo = body?.sessionInfo ?? {}
    const templateKey = toText(body?.templateKey, 80)
    const answersInput = Array.isArray(body?.answers)
      ? (body.answers as QCAnswerInput[])
      : []
    const generalNote = toText(body?.generalNote, 10000)
    const assistantName = toText(body?.assistantName, 255)
    const teacherRank = toText(body?.teacherRank, 100)

    const templates = await fetchQCTemplates()
    const template = findQCTemplate(templates, templateKey)
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Loại phiếu QC không hợp lệ' },
        { status: 400 },
      )
    }

    const classId = toText(classInfo?.id, 120)
    const className = toText(classInfo?.name, 500)
    const centerName = toText(
      classInfo?.centreShortName || classInfo?.centreName,
      255,
    )
    const classCode = className
    const teacherNames = Array.isArray(classInfo?.teacherNames)
      ? classInfo.teacherNames.map((name: unknown) => toText(name, 255)).filter(Boolean)
      : []
    const teacherName = toText(teacherNames.join(', '), 500)
    const teacherAccounts = Array.isArray(classInfo?.teacherAccounts)
      ? classInfo.teacherAccounts.map(normalizeTeacherAccount)
      : []
    const primaryTeacherAccount =
      teacherAccounts.find(
        (account: ReturnType<typeof normalizeTeacherAccount>) =>
          account.id || account.email || account.username || account.code,
      ) ?? normalizeTeacherAccount(null)
    const studentCount = Number(classInfo?.studentCount)

    if (!classId || !className || !centerName) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin lớp cần QC' },
        { status: 400 },
      )
    }

    if (!Number.isInteger(studentCount) || studentCount < 0) {
      return NextResponse.json(
        { success: false, error: 'Sĩ số lớp không hợp lệ' },
        { status: 400 },
      )
    }

    const accessibleCenters =
      gate.role === 'super_admin' ? null : await getAccessibleCenters(gate.sessionEmail)
    const allowedKeys =
      gate.role === 'super_admin'
        ? null
        : buildCenterKeys((accessibleCenters ?? []) as AccessibleCenter[])

    if (
      !centerIsAccessible(
        [classInfo?.centreShortName, classInfo?.centreName, classInfo?.centreId],
        allowedKeys,
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo QC cho cơ sở này' },
        { status: 403 },
      )
    }

    const sessionWindow = getQCWindowInfo({
      date: sessionInfo?.date,
      startTime: sessionInfo?.startTime,
      endTime: sessionInfo?.endTime,
      sessionHour: sessionInfo?.sessionHour,
    })
    if (!sessionWindow.canCreateQC) {
      return NextResponse.json(
        {
          success: false,
          error:
            sessionWindow.qcWindowStatus === 'upcoming'
              ? 'Buổi học này chưa nằm trong khung 24h trước giờ học để tạo phiếu QC'
              : sessionWindow.qcWindowStatus === 'missing-time'
                ? 'Buổi học thiếu giờ bắt đầu hoặc giờ kết thúc trên LMS'
                : 'Buổi học này đã quá khung 24h sau giờ học để tạo phiếu QC',
        },
        { status: 400 },
      )
    }

    const answerByCriterion = new Map<string, QCAnswerInput>()
    answersInput.forEach((answer) => {
      const criterionId = toText(answer?.criterionId, 300)
      if (criterionId) answerByCriterion.set(criterionId, answer)
    })

    const answers = template.criteria.map((criterion) => {
      const input = answerByCriterion.get(criterion.id)
      const selectedIds = new Set(normalizeOptionIds(input))
      const selectedOptions = criterion.options.filter((option) =>
        selectedIds.has(option.id),
      )
      if (selectedOptions.length !== selectedIds.size) {
        throw new Error(`Lựa chọn không hợp lệ cho tiêu chí: ${criterion.criterion}`)
      }
      if (criterion.selectionMode === 'single' && selectedOptions.length !== 1) {
        throw new Error(`Vui lòng chọn đánh giá cho tiêu chí: ${criterion.criterion}`)
      }
      const score = selectedOptions.reduce((sum, option) => sum + option.score, 0)
      return {
        criterionId: criterion.id,
        category: criterion.category,
        criterion: criterion.criterion,
        selectionMode: criterion.selectionMode,
        selectedOptionIds: selectedOptions.map((option) => option.id),
        selectedOptions: selectedOptions.map((option) => ({
          optionId: option.id,
          guide: option.guide,
          score: option.score,
        })),
        score,
        note: toText(input?.note, 5000),
      }
    })

    const totalScore = answers.reduce((sum, answer) => sum + answer.score, 0)
    const maxScore = template.maxScore
    const normalizedScore = maxScore > 0 ? (totalScore / maxScore) * 10 : 0
    const resultLabel =
      normalizedScore >= 9.5
        ? 'Tốt'
        : normalizedScore >= 8.0
          ? 'Đạt'
          : normalizedScore >= 7.0
            ? 'Khá'
            : normalizedScore >= 5.0
              ? 'Rủi ro vừa'
              : 'Rủi ro cao'
    const sessionIndexRaw = Number(sessionInfo?.sessionIndex)
    const sessionIndex = Number.isInteger(sessionIndexRaw) && sessionIndexRaw > 0
      ? sessionIndexRaw
      : null

    const result = await pool.query(
      `
      INSERT INTO quan_ly_qc (
        template_key,
        template_title,
        sheet_name,
        class_lms_id,
        class_code,
        class_name,
        center_lms_id,
        center_name,
        teacher_name,
        teacher_lms_id,
        teacher_username,
        teacher_code,
        teacher_email,
        teacher_rank,
        assistant_name,
        student_count,
        session_lms_id,
        session_index,
        session_date,
        session_start_time,
        session_end_time,
        course_name,
        course_line_name,
        criteria_snapshot,
        answers,
        total_score,
        max_score,
        raw_total_score,
        raw_max_score,
        result_label,
        general_note,
        class_snapshot,
        created_by_email,
        signed
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23,
        $24::jsonb, $25::jsonb, $26, $27,
        $28, $29, $30, $31, $32::jsonb, $33, FALSE
      )
      RETURNING *
      `,
      [
        template.key,
        template.title,
        template.sheetName,
        classId,
        classCode,
        className,
        toText(classInfo?.centreId, 120) || null,
        centerName,
        teacherName || null,
        primaryTeacherAccount.id || null,
        primaryTeacherAccount.username || null,
        primaryTeacherAccount.code || null,
        primaryTeacherAccount.email || null,
        teacherRank || null,
        assistantName || null,
        studentCount,
        toText(sessionInfo?.id, 120) || null,
        sessionIndex,
        normalizeDate(sessionInfo?.date),
        normalizeDate(sessionInfo?.startTime),
        normalizeDate(sessionInfo?.endTime),
        toText(classInfo?.courseName, 255) || null,
        toText(classInfo?.courseLineName, 255) || null,
        JSON.stringify(template),
        JSON.stringify(answers),
        normalizedScore,
        10,
        totalScore,
        maxScore,
        resultLabel,
        generalNote || null,
        JSON.stringify({ classInfo, sessionInfo }),
        gate.sessionEmail,
      ],
    )

    return NextResponse.json({
      success: true,
      record: result.rows[0],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lưu phiếu QC'
    console.error('[quan-ly-qc] POST error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
