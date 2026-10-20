import {
  FACILITY_EVALUATION_ALLOWED_ROLE_CODES,
  FACILITY_EVALUATION_CRITERIA,
  FACILITY_EVALUATION_LEADER_ROLE_CODES,
  FACILITY_EVALUATION_RECIPIENT_ROLE_CODES,
  convertFacilityScoreToTen,
  getVietnamMonthKey,
} from '@/lib/facility-evaluation'
import { fetchFacilityEvaluationLmsRecipients } from '@/lib/facility-evaluation-lms'
import {
  requireBearerDbRoles,
  requireBearerDbRolesMutation,
} from '@/lib/auth-server'
import { getAccessibleCenters, getAllActiveCenters } from '@/lib/center-access'
import pool from '@/lib/db'
import {
  applyRefreshedCookies,
  getOrRefreshLmsToken,
  loginFallbackLmsAccount,
} from '@/lib/lms-token-helper'
import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type CenterRow = {
  id: number
  full_name: string
  short_code: string | null
  display_name?: string | null
  region: string | null
  email?: string | null
}

type RecipientOption = {
  id: string
  centerId: number
  centerName: string
  centerShortCode: string | null
  centerRegion: string | null
  code: string | null
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  source: 'lms_users' | 'manual'
}

type LeaderOption = {
  id: string
  centerId: number
  centerName: string
  centerShortCode: string | null
  centerRegion: string | null
  code: string
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  areas: string[]
}

type FacilityEvaluationAccess = {
  allowed: boolean
  canViewAll: boolean
  roleCodes: string[]
  userRole: string
}

type PublicFacilityEvaluationFormRow = {
  id: number
  form_month: string
  public_token: string
  created_by_email: string
  created_at: string
  is_active: boolean
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeKey(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function splitAreaText(value: unknown): string[] {
  return normalizeText(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function parseJsonAreas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeText(item)).filter(Boolean)
      }
    } catch {
      return []
    }
  }

  return []
}

function parseAreas(row: { area?: unknown; areas?: unknown }): string[] {
  const jsonAreas = parseJsonAreas(row.areas)
  if (jsonAreas.length > 0) return uniqueStrings(jsonAreas)
  return uniqueStrings(splitAreaText(row.area))
}

function isMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

function centerMatchesLeader(center: CenterRow, leader: {
  center?: unknown
  area?: unknown
  areas?: unknown
}): boolean {
  const jsonAreaKeys = parseJsonAreas(leader.areas).map(normalizeKey)
  const areaKeys = jsonAreaKeys.length
    ? jsonAreaKeys
    : splitAreaText(leader.area).map(normalizeKey)
  const regionKey = normalizeKey(center.region)
  if (regionKey && areaKeys.includes(regionKey)) return true

  if (jsonAreaKeys.length > 0) return false

  const leaderCenter = normalizeKey(leader.center)
  if (!leaderCenter) return false

  const candidates = [
    center.full_name,
    center.display_name,
    center.short_code,
    center.region,
  ].map(normalizeKey).filter(Boolean)

  return candidates.some(
    (candidate) => leaderCenter.includes(candidate) || candidate.includes(leaderCenter),
  )
}

function centerTokens(center: CenterRow): string[] {
  return [center.id, center.full_name, center.short_code, center.display_name]
    .map(normalizeKey)
    .filter(Boolean)
}

function centerIsAccessible(centerId: number, centers: CenterRow[]): boolean {
  return centers.some((center) => Number(center.id) === centerId)
}

function mapCenter(row: CenterRow) {
  return {
    id: Number(row.id),
    fullName: normalizeText(row.full_name),
    displayName: normalizeText(row.display_name || row.full_name),
    shortCode: normalizeText(row.short_code) || null,
    region: normalizeText(row.region) || null,
  }
}

function isFacilityEvaluationCenter(row: CenterRow): boolean {
  const key = normalizeKey([
    row.full_name,
    row.display_name,
    row.short_code,
    row.email,
  ].join(' '))
  return !key.includes('testmail')
}

function filterFacilityEvaluationCenters(centers: CenterRow[]): CenterRow[] {
  return centers.filter(isFacilityEvaluationCenter)
}

function mapRecord(row: any) {
  const scores = [
    Number(row.criterion_1_score) || 0,
    Number(row.criterion_2_score) || 0,
    Number(row.criterion_3_score) || 0,
    Number(row.criterion_4_score) || 0,
    Number(row.criterion_5_score) || 0,
  ]
  const rawScores = [
    Number(row.criterion_1_raw) || 0,
    Number(row.criterion_2_raw) || 0,
    Number(row.criterion_3_raw) || 0,
    Number(row.criterion_4_raw) || 0,
    Number(row.criterion_5_raw) || 0,
  ]

  return {
    id: Number(row.id),
    formMonth: row.form_month,
    centerId: row.center_id ? Number(row.center_id) : null,
    centerName: row.center_name,
    centerShortCode: row.center_short_code,
    centerRegion: row.center_region,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    recipientRoleCode: row.recipient_role_code,
    recipientRoleName: row.recipient_role_name,
    leaderCode: row.leader_code,
    leaderName: row.leader_name,
    leaderEmail: row.leader_email,
    leaderRoleCode: row.leader_role_code,
    leaderRoleName: row.leader_role_name,
    scores,
    rawScores,
    totalScore: Number(row.total_score) || 0,
    improvementNote: row.improvement_note || '',
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name || row.created_by_email,
    createdAt: row.created_at,
  }
}

function createPublicFormToken(): string {
  return randomBytes(24).toString('base64url')
}

function publicFormUrl(request: NextRequest, token: string): string {
  return `${request.nextUrl.origin}/public/quan-ly-qc/danh-gia-co-so/${encodeURIComponent(token)}`
}

function mapPublicForm(row: PublicFacilityEvaluationFormRow, request: NextRequest) {
  return {
    id: Number(row.id),
    formMonth: row.form_month,
    publicToken: row.public_token,
    publicUrl: publicFormUrl(request, row.public_token),
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    isActive: Boolean(row.is_active),
  }
}

async function queryPublicForms(month?: string): Promise<PublicFacilityEvaluationFormRow[]> {
  const tableExists = await pool.query(
    `SELECT to_regclass('public.facility_evaluation_forms') AS table_name`,
  )
  if (!tableExists.rows[0]?.table_name) return []

  if (month) {
    const result = await pool.query(
      `SELECT id, form_month, public_token, created_by_email, created_at, is_active
       FROM facility_evaluation_forms
       WHERE form_month = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [month],
    )
    return result.rows as PublicFacilityEvaluationFormRow[]
  }

  const result = await pool.query(
    `SELECT id, form_month, public_token, created_by_email, created_at, is_active
     FROM facility_evaluation_forms
     WHERE is_active = true
     ORDER BY form_month DESC, created_at DESC
     LIMIT 100`,
  )
  return result.rows as PublicFacilityEvaluationFormRow[]
}

async function getOrCreatePublicForm(
  month: string,
  createdByEmail: string,
): Promise<PublicFacilityEvaluationFormRow> {
  const existing = await queryPublicForms(month)
  if (existing[0]) return existing[0]

  try {
    const result = await pool.query(
      `INSERT INTO facility_evaluation_forms (
         form_month,
         public_token,
         created_by_email
       )
       VALUES ($1, $2, $3)
       RETURNING id, form_month, public_token, created_by_email, created_at, is_active`,
      [month, createPublicFormToken(), createdByEmail],
    )
    return result.rows[0] as PublicFacilityEvaluationFormRow
  } catch (error: any) {
    if (error?.code === '23505') {
      const afterConflict = await queryPublicForms(month)
      if (afterConflict[0]) return afterConflict[0]
    }
    throw error
  }
}

async function resolveFacilityEvaluationAccess(
  email: string,
  userRole: string,
): Promise<FacilityEvaluationAccess> {
  const normalized = email.trim().toLowerCase()
  const roleCodes = new Set<string>()

  const appUserResult = await pool.query(
    `SELECT id, role
     FROM app_users
     WHERE LOWER(email) = $1 AND is_active = true
     LIMIT 1`,
    [normalized],
  )
  const appUser = appUserResult.rows[0] as { id: number; role: string } | undefined

  if (appUser) {
    const appRoles = await pool.query(
      `SELECT UPPER(role_code::text) AS role_code
       FROM user_roles
       WHERE user_id = $1`,
      [appUser.id],
    )
    appRoles.rows.forEach((row: { role_code: string }) => {
      if (row.role_code) roleCodes.add(row.role_code)
    })
  }

  const leaderRoles = await pool.query(
    `SELECT UPPER(role_code::text) AS role_code
     FROM teaching_leaders
     WHERE LOWER(TRIM(email)) = $1
       AND status IS DISTINCT FROM 'Deactive'`,
    [normalized],
  )
  leaderRoles.rows.forEach((row: { role_code: string }) => {
    if (row.role_code) roleCodes.add(row.role_code)
  })

  const allowedRoleCodes = new Set(FACILITY_EVALUATION_ALLOWED_ROLE_CODES)
  const canUseByRole = Array.from(roleCodes).some((roleCode) =>
    allowedRoleCodes.has(roleCode as (typeof FACILITY_EVALUATION_ALLOWED_ROLE_CODES)[number]),
  )
  const isHoTeaching =
    normalized.includes('hoteaching') ||
    normalized.includes('hr-teaching')
  const canViewAll =
    userRole === 'super_admin' ||
    userRole === 'admin' ||
    isHoTeaching ||
    roleCodes.has('TM') ||
    roleCodes.has('AD') ||
    roleCodes.has('K12') ||
    roleCodes.has('HOMINDX') ||
    roleCodes.has('HO')

  return {
    allowed:
      userRole === 'super_admin' ||
      userRole === 'admin' ||
      isHoTeaching ||
      canUseByRole,
    canViewAll,
    roleCodes: Array.from(roleCodes).sort(),
    userRole,
  }
}

async function getCentersForAccess(
  email: string,
  access: FacilityEvaluationAccess,
): Promise<CenterRow[]> {
  if (access.canViewAll) {
    return filterFacilityEvaluationCenters((await getAllActiveCenters()) as CenterRow[])
  }
  return filterFacilityEvaluationCenters((await getAccessibleCenters(email)) as CenterRow[])
}

async function queryRecipients(
  centers: CenterRow[],
  authHeader?: string,
): Promise<RecipientOption[]> {
  return fetchFacilityEvaluationLmsRecipients(
    centers,
    authHeader,
  ) as Promise<RecipientOption[]>
}

async function getLmsRecipientsForRequest(
  request: NextRequest,
  centers: CenterRow[],
) {
  let tokenSession = await getOrRefreshLmsToken(request)
  let authHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined

  try {
    const recipients = await queryRecipients(centers, authHeader)
    return { recipients, tokenSession }
  } catch (error: any) {
    console.warn(
      '[facility-evaluations] LMS recipient lookup failed, retrying fallback:',
      error?.message,
    )
    tokenSession = await loginFallbackLmsAccount()
    authHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined
    const recipients = await queryRecipients(centers, authHeader)
    return { recipients, tokenSession }
  }
}

async function queryLeaders(centers: CenterRow[]): Promise<LeaderOption[]> {
  if (centers.length === 0) return []

  const result = await pool.query(
    `
    SELECT code, full_name, email, role_code, role_name, center, area, areas, status
    FROM teaching_leaders
    WHERE UPPER(COALESCE(role_code, '')) = ANY($1::text[])
      AND status IS DISTINCT FROM 'Deactive'
    ORDER BY role_code, full_name
    `,
    [FACILITY_EVALUATION_LEADER_ROLE_CODES],
  )

  const roleOrder = new Map(
    FACILITY_EVALUATION_LEADER_ROLE_CODES.map((roleCode, index) => [roleCode, index]),
  )
  const leaders: LeaderOption[] = []
  const seen = new Set<string>()

  result.rows.forEach((row: any) => {
    centers.forEach((center) => {
      if (!centerMatchesLeader(center, row)) return
      const code = normalizeText(row.code)
      const roleCode = normalizeText(row.role_code).toUpperCase()
      const key = `${center.id}:${code}:${roleCode}`
      if (seen.has(key)) return
      seen.add(key)
      leaders.push({
        id: `leader:${code}:${roleCode}:${center.id}`,
        centerId: Number(center.id),
        centerName: center.full_name,
        centerShortCode: center.short_code,
        centerRegion: center.region,
        code,
        fullName: normalizeText(row.full_name),
        email: normalizeText(row.email) || null,
        roleCode,
        roleName: normalizeText(row.role_name) || roleCode,
        areas: parseAreas(row),
      })
    })
  })

  return leaders.sort((a, b) => {
    const centerCompare = a.centerName.localeCompare(b.centerName, 'vi')
    if (centerCompare !== 0) return centerCompare
    const roleCompare =
      (roleOrder.get(a.roleCode as any) ?? 99) -
      (roleOrder.get(b.roleCode as any) ?? 99)
    if (roleCompare !== 0) return roleCompare
    return a.fullName.localeCompare(b.fullName, 'vi')
  })
}

async function queryRecords(
  month: string,
  centers: CenterRow[],
  access: FacilityEvaluationAccess,
  sessionEmail: string,
) {
  const params: unknown[] = [month]
  let where = 'WHERE fe.form_month = $1'

  if (!access.canViewAll) {
    const centerIds = centers.map((center) => Number(center.id)).filter(Number.isFinite)
    params.push(centerIds, sessionEmail)
    where += ` AND (fe.center_id = ANY($2::int[]) OR LOWER(fe.created_by_email) = LOWER($3))`
  }

  const result = await pool.query(
    `
    SELECT
      fe.*,
      COALESCE(u.display_name, fe.created_by_email) AS created_by_name
    FROM facility_evaluations fe
    LEFT JOIN app_users u ON LOWER(u.email) = LOWER(fe.created_by_email)
    ${where}
    ORDER BY fe.created_at DESC
    LIMIT 300
    `,
    params,
  )

  return result.rows.map(mapRecord)
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, [
      'super_admin',
      'admin',
      'manager',
    ])
    if (!gate.ok) return gate.response

    const access = await resolveFacilityEvaluationAccess(
      gate.sessionEmail,
      gate.role,
    )
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý điểm đánh giá cơ sở' },
        { status: 403 },
      )
    }

    const requestedMonth = normalizeText(request.nextUrl.searchParams.get('month'))
    const formMonth = isMonthKey(requestedMonth)
      ? requestedMonth
      : getVietnamMonthKey()
    const centers = await getCentersForAccess(gate.sessionEmail, access)
    const [recipientResult, leaders, records, publicForms] = await Promise.all([
      getLmsRecipientsForRequest(request, centers),
      queryLeaders(centers),
      queryRecords(formMonth, centers, access, gate.sessionEmail),
      queryPublicForms(),
    ])
    const { recipients, tokenSession } = recipientResult

    const response = NextResponse.json({
      success: true,
      formMonth,
      access,
      centers: centers.map(mapCenter),
      recipients,
      leaders,
      records,
      publicForms: publicForms.map((form) => mapPublicForm(form, request)),
      criteria: FACILITY_EVALUATION_CRITERIA,
      recipientDataReady: recipients.length > 0,
    })
    applyRefreshedCookies(response, tokenSession)
    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Không thể tải dữ liệu đánh giá cơ sở'
    console.error('[facility-evaluations] GET error:', error)
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

    const access = await resolveFacilityEvaluationAccess(
      gate.sessionEmail,
      gate.role,
    )
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền gửi điểm đánh giá cơ sở' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const formMonthRaw = normalizeText(body?.formMonth)
    const action = normalizeText(body?.action)

    if (action === 'create_public_form') {
      if (!isMonthKey(formMonthRaw)) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng chọn tháng trước khi tạo form' },
          { status: 400 },
        )
      }
      const formMonth = formMonthRaw
      const publicForm = await getOrCreatePublicForm(formMonth, gate.sessionEmail)
      return NextResponse.json({
        success: true,
        publicForm: mapPublicForm(publicForm, request),
      })
    }

    const formMonth = isMonthKey(formMonthRaw) ? formMonthRaw : getVietnamMonthKey()

    const centerId = Number(body?.centerId)
    const recipientId = normalizeText(body?.recipientId)
    const leaderId = normalizeText(body?.leaderId)
    const improvementNote = normalizeText(body?.improvementNote).slice(0, 10000)
    const manualRecipientName = normalizeText(body?.manualRecipientName).slice(0, 255)
    const manualRecipientRole = normalizeText(body?.manualRecipientRole)
      .toUpperCase()
      .slice(0, 20)

    if (!Number.isInteger(centerId) || centerId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn cơ sở' },
        { status: 400 },
      )
    }

    const centers = await getCentersForAccess(gate.sessionEmail, access)
    if (!centerIsAccessible(centerId, centers)) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền đánh giá cơ sở này' },
        { status: 403 },
      )
    }

    const selectedCenter = centers.find((center) => Number(center.id) === centerId)!
    const centerKeySet = new Set(centerTokens(selectedCenter))

    const [recipientResult, leaders] = await Promise.all([
      getLmsRecipientsForRequest(request, centers),
      queryLeaders(centers),
    ])
    const { recipients } = recipientResult
    const selectedRecipient = recipients.find(
      (recipient) =>
        recipient.id === recipientId &&
        recipient.centerId === centerId,
    )
    let recipient: RecipientOption | null = selectedRecipient ?? null

    if (!recipient) {
      const allowedManualRole = FACILITY_EVALUATION_RECIPIENT_ROLE_CODES.includes(
        manualRecipientRole as (typeof FACILITY_EVALUATION_RECIPIENT_ROLE_CODES)[number],
      )
      if (!manualRecipientName || !allowedManualRole) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng chọn CM/CSL hoặc nhập người nhận tạm thời hợp lệ',
          },
          { status: 400 },
        )
      }

      recipient = {
        id: `manual:${normalizeKey(manualRecipientName)}:${manualRecipientRole}:${centerId}`,
        centerId,
        centerName: selectedCenter.full_name,
        centerShortCode: selectedCenter.short_code,
        centerRegion: selectedCenter.region,
        code: null,
        fullName: manualRecipientName,
        email: null,
        roleCode: manualRecipientRole,
        roleName: manualRecipientRole,
        source: 'manual',
      }
    }

    const leader = leaders.find(
      (item) => item.id === leaderId && item.centerId === centerId,
    )
    if (!leader) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn một leader thuộc khu vực của cơ sở' },
        { status: 400 },
      )
    }

    const rawScores = FACILITY_EVALUATION_CRITERIA.map((criterion) => {
      const rawValue = Number(body?.scores?.[criterion.key])
      if (!Number.isInteger(rawValue) || rawValue < 1 || rawValue > 5) {
        throw new Error(`Vui lòng chọn điểm cho tiêu chí: ${criterion.label}`)
      }
      return rawValue
    })
    if (!improvementNote) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập nội dung góp ý ở tiêu chí 6' },
        { status: 400 },
      )
    }

    const convertedScores = rawScores.map(convertFacilityScoreToTen)
    const totalScore =
      convertedScores.reduce((sum, score) => sum + score, 0) /
      convertedScores.length
    const answers = FACILITY_EVALUATION_CRITERIA.map((criterion, index) => ({
      criterionKey: criterion.key,
      criterion: criterion.label,
      rawScore: rawScores[index],
      score: convertedScores[index],
    }))

    const result = await pool.query(
      `
      INSERT INTO facility_evaluations (
        form_month,
        center_id,
        center_name,
        center_short_code,
        center_region,
        recipient_id,
        recipient_name,
        recipient_email,
        recipient_role_code,
        recipient_role_name,
        leader_code,
        leader_name,
        leader_email,
        leader_role_code,
        leader_role_name,
        criterion_1_raw,
        criterion_1_score,
        criterion_2_raw,
        criterion_2_score,
        criterion_3_raw,
        criterion_3_score,
        criterion_4_raw,
        criterion_4_score,
        criterion_5_raw,
        criterion_5_score,
        total_score,
        improvement_note,
        answers,
        created_by_email
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28::jsonb, $29
      )
      RETURNING *
      `,
      [
        formMonth,
        centerId,
        selectedCenter.full_name,
        selectedCenter.short_code || null,
        selectedCenter.region || null,
        recipient.id,
        recipient.fullName,
        recipient.email,
        recipient.roleCode,
        recipient.roleName,
        leader.code,
        leader.fullName,
        leader.email,
        leader.roleCode,
        leader.roleName,
        rawScores[0],
        convertedScores[0],
        rawScores[1],
        convertedScores[1],
        rawScores[2],
        convertedScores[2],
        rawScores[3],
        convertedScores[3],
        rawScores[4],
        convertedScores[4],
        totalScore,
        improvementNote,
        JSON.stringify({
          criteria: answers,
          criterion6: improvementNote,
          centerTokens: Array.from(centerKeySet),
          recipientSource: recipient.source,
        }),
        gate.sessionEmail,
      ],
    )

    return NextResponse.json({
      success: true,
      record: mapRecord(result.rows[0]),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Không thể lưu điểm đánh giá cơ sở'
    console.error('[facility-evaluations] POST error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
