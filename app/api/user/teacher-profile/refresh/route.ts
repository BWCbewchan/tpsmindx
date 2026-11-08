import { NextRequest, NextResponse } from 'next/server'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { rateLimitOr429Async } from '@/lib/rate-limit-memory'
import { loadTeacherOnboarding } from '@/lib/teacher-onboarding-source'
import pool from '@/lib/db'

export const maxDuration = 45

// Only source-owned profile fields may be refreshed. Account roles/permissions and
// teacher identifiers are deliberately absent from this mapping.
const fields: Record<string, string> = {
  full_name: 'Full name', user_name: 'User name', personal_email: 'Personal email',
  phone_number: 'Phone number', status_update: 'Status (update)', centers: 'Centers',
  khoi_final: 'Khối final', role: 'Role', course_line: 'Course line', rank: 'Rank',
  joined_date: 'Joined date', teacher_point: 'Teacher point', data_hr_raw: 'Data HR (Raw)',
  status_check: 'Status check', bu_check: 'BU check', khoi_check: 'Khối check',
  check_col: 'CHECK', te_quan_ly: 'TE quản lý', leader_quan_ly: 'Leader quản lý',
  rate_k12_check: 'Rate K12 check', rank_k12_check: 'Rank K12 check',
  'Full name': 'Full name', 'User name': 'User name',
  'Main centre': 'BU check', 'Course Line': 'Course line',
}

export async function POST(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response
  const email = auth.sessionEmail.trim().toLowerCase()
  const limited = await rateLimitOr429Async(`teacher-profile-refresh:${email}`, 2, 60_000)
  if (limited) return limited
  try {
    // No client email/code/profile payload is accepted, even for administrators.
    const source = await loadTeacherOnboarding(email)
    if (!source || !source['Code']?.trim() || !source['Full name']?.trim() || source['Work email']?.trim().toLowerCase() !== email) {
      return NextResponse.json({ success: false, error: 'Nguồn chưa có đầy đủ thông tin của bạn. Thông tin hiện tại được giữ nguyên; vui lòng thử lại sau khi có bảng công hoặc đợt review.' }, { status: 422 })
    }
    const columns = { ...fields, 'Main centre': source['BU check'] ? 'BU check' : 'Centers', status: source['Status check'] ? 'Status check' : 'Status (update)',
      Status: source['Status check'] ? 'Status check' : 'Status (update)',
      main_centre: source['BU check'] ? 'BU check' : 'Centers' }
    const values: unknown[] = []
    const assignments = Object.entries(columns).map(([column, header]) => {
      values.push(String(source[header] || '').trim())
      return `"${column}" = COALESCE(NULLIF($${values.length}, ''), "${column}")`
    })
    // Preserve existing snapshot entries when the upstream sheet has blanks.
    values.push(JSON.stringify(Object.fromEntries(Object.entries(source).filter(([, value]) => value.trim()))))
    assignments.push(`onboarding_snapshot = COALESCE(onboarding_snapshot, '{}'::jsonb) || $${values.length}::jsonb`)
    values.push(email)
    const result = await pool.query(`UPDATE teachers SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(TRIM(COALESCE(work_email, ''))) = $${values.length}
         OR LOWER(TRIM(COALESCE("Work email", ''))) = $${values.length}
      RETURNING code, updated_at`, values)
    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: 'Chưa có hồ sơ giáo viên trong TPS. Vui lòng xác nhận thông tin tại trang kiểm tra dữ liệu trước.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, updatedAt: result.rows[0].updated_at }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[teacher-profile-refresh] Failed', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ success: false, error: 'Chưa thể cập nhật thông tin. Vui lòng thử lại sau; thông tin hiện tại được giữ nguyên.' }, { status: 503 })
  }
}
