import {
  FACILITY_EVALUATION_CRITERIA,
  FACILITY_EVALUATION_LEADER_ROLE_CODES,
  FACILITY_EVALUATION_RECIPIENT_ROLE_CODES,
  convertFacilityScoreToTen,
} from '@/lib/facility-evaluation'
import { fetchFacilityEvaluationLmsRecipients } from '@/lib/facility-evaluation-lms'
import { getAllActiveCenters } from '@/lib/center-access'
import pool from '@/lib/db'
import { loginFallbackLmsAccount } from '@/lib/lms-token-helper'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ token: string }>
}

type CenterRow = {
  id: number
  full_name: string
  short_code: string | null
  display_name?: string | null
  region: string | null
}

type PublicFormRow = {
  id: number
  form_month: string
  public_token: string
  created_by_email: string
  is_active: boolean
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

function centerMatchesLeader(
  center: CenterRow,
  leader: { center?: unknown; area?: unknown; areas?: unknown },
): boolean {
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
  ].join(' '))
  return !key.includes('testmail')
}

function filterFacilityEvaluationCenters(centers: CenterRow[]): CenterRow[] {
  return centers.filter(isFacilityEvaluationCenter)
}

async function getPublicForm(token: string): Promise<PublicFormRow | null> {
  const result = await pool.query(
    `SELECT id, form_month, public_token, created_by_email, is_active
     FROM facility_evaluation_forms
     WHERE public_token = $1 AND is_active = true
     LIMIT 1`,
    [token],
  )
  return (result.rows[0] as PublicFormRow | undefined) ?? null
}

async function queryRecipients(centers: CenterRow[]): Promise<RecipientOption[]> {
  const tokenSession = await loginFallbackLmsAccount()
  const authHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined
  return fetchFacilityEvaluationLmsRecipients(
    centers,
    authHeader,
  ) as Promise<RecipientOption[]>
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

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const publicForm = await getPublicForm(normalizeText(token))
    if (!publicForm) {
      return NextResponse.json(
        { success: false, error: 'Link form không tồn tại hoặc đã bị khóa' },
        { status: 404 },
      )
    }

    const centers = filterFacilityEvaluationCenters(
      (await getAllActiveCenters()) as CenterRow[],
    )
    const [recipients, leaders] = await Promise.all([
      queryRecipients(centers),
      queryLeaders(centers),
    ])

    return NextResponse.json({
      success: true,
      formMonth: publicForm.form_month,
      centers: centers.map(mapCenter),
      recipients,
      leaders,
      criteria: FACILITY_EVALUATION_CRITERIA,
      recipientDataReady: recipients.length > 0,
    })
  } catch (error) {
    console.error('[public facility-evaluations] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải form đánh giá cơ sở' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const publicForm = await getPublicForm(normalizeText(token))
    if (!publicForm) {
      return NextResponse.json(
        { success: false, error: 'Link form không tồn tại hoặc đã bị khóa' },
        { status: 404 },
      )
    }

    const body = await request.json().catch(() => ({}))
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

    const centers = filterFacilityEvaluationCenters(
      (await getAllActiveCenters()) as CenterRow[],
    )
    const selectedCenter = centers.find((center) => Number(center.id) === centerId)
    if (!selectedCenter) {
      return NextResponse.json(
        { success: false, error: 'Cơ sở không hợp lệ' },
        { status: 400 },
      )
    }

    const [recipients, leaders] = await Promise.all([
      queryRecipients(centers),
      queryLeaders(centers),
    ])
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
          { success: false, error: 'Vui lòng nhập người nhận hợp lệ' },
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
        { success: false, error: 'Vui lòng chọn leader thuộc khu vực của cơ sở' },
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
      RETURNING id
      `,
      [
        publicForm.form_month,
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
          source: 'public_facility_evaluation_form',
          formId: publicForm.id,
          publicToken: publicForm.public_token,
          criteria: answers,
          criterion6: improvementNote,
          recipientSource: recipient.source,
        }),
        `public-form:${publicForm.id}`,
      ],
    )

    return NextResponse.json({
      success: true,
      recordId: Number(result.rows[0]?.id),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Không thể gửi form đánh giá cơ sở'
    console.error('[public facility-evaluations] POST error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
