import { NextRequest, NextResponse } from 'next/server'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { checkHrefPermission } from '@/lib/menu-permissions'
import { rateLimitOr429Async } from '@/lib/rate-limit-memory'
import { loadTeacherOnboardingMatches } from '@/lib/teacher-onboarding-source'
import { insertMissingTeacherFromSource } from '@/lib/teacher-source-import'
import { findTeacherRowByLookupQuery } from '@/lib/teacher-profile-bundle'
import pool from '@/lib/db'

export const maxDuration = 45

export async function POST(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response
  if (!checkHrefPermission('/admin/ho-so-giao-vien', auth.resolvedAccess)) {
    return NextResponse.json({ success: false, error: 'Chưa được cấp quyền Hồ sơ giáo viên' }, { status: 403 })
  }
  const limited = await rateLimitOr429Async(`import-missing-teacher:${auth.sessionEmail}`, 20, 60_000)
  if (limited) return limited
  let query: string
  try {
    const body = await request.json()
    if (typeof body?.query !== 'string' || body.query.trim().length < 2 || body.query.trim().length > 120) {
      return NextResponse.json({ success: false, error: 'Nhập mã, email hoặc tên giáo viên từ 2 đến 120 ký tự' }, { status: 400 })
    }
    query = body.query.trim()
  } catch {
    return NextResponse.json({ success: false, error: 'Yêu cầu không hợp lệ' }, { status: 400 })
  }
  try {
    const existing = await findTeacherRowByLookupQuery(pool, query)
    if (existing.row) return NextResponse.json({ success: true, imported: false, code: existing.row.code })
    if (existing.matches?.length) return NextResponse.json({ success: true, chooseTeacher: true, matches: existing.matches })
    const matches = await loadTeacherOnboardingMatches(query)
    if (!matches.length) return NextResponse.json({ success: false, notFound: true, error: 'Không tìm thấy giáo viên trong TPS hoặc nguồn dữ liệu gốc' }, { status: 404 })
    if (matches.length > 12) return NextResponse.json({ success: false, error: 'Có quá nhiều giáo viên trùng tên. Vui lòng nhập mã hoặc tên cụ thể hơn.' }, { status: 422 })
    if (new Set(matches.map(row => row.Code?.trim().toLowerCase())).size !== matches.length) {
      return NextResponse.json({ success: false, error: 'Nguồn dữ liệu có mã giáo viên trùng lặp. Vui lòng liên hệ quản lý dữ liệu.' }, { status: 409 })
    }
    if (matches.length > 1) {
      return NextResponse.json({ success: true, chooseTeacher: true, matches: matches.map(row => ({
        code: row.Code, fullName: row['Full name'], center: row['BU check'] || row.Centers || '',
      })) })
    }
    if (!['Code', 'Full name', 'Work email'].every(key => matches[0][key]?.trim())) {
      return NextResponse.json({ success: false, error: 'Nguồn chưa có đầy đủ mã, tên và email giáo viên. Vui lòng liên hệ quản lý dữ liệu.' }, { status: 422 })
    }
    const result = await insertMissingTeacherFromSource(pool, matches[0])
    return NextResponse.json({ success: true, imported: result.rows.length > 0, code: matches[0].Code }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[import-missing-teacher]', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ success: false, error: 'Chưa thể đồng bộ nguồn dữ liệu. Vui lòng thử tìm lại sau.' }, { status: 503 })
  }
}
