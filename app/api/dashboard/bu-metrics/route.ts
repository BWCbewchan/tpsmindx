import { withApiProtection } from '@/lib/api-protection'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import { getAccessibleCenters } from '@/lib/center-access'
import { resolveAppUserAccessForEmail } from '@/lib/app-user-access'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export interface BUMetric {
  bu_name: string
  teacher_count: number
  avg_expertise_score: number | null
  /** Số GV đã từng thi chuyên sâu ít nhất 1 lần */
  expertise_participant_count: number
  max_teacher_score: number | null
  max_score_teachers_count: number
}

export interface SimulatibleManager {
  email: string
  display_name: string
  role_code: string
}

/**
 * GET /api/dashboard/bu-metrics
 *
 * Trả về thống kê theo từng BU (cơ sở):
 *   - Số lượng giáo viên active
 *   - Điểm chuyên sâu trung bình (AVG của tất cả lần thi)
 *
 * Quyền truy cập: super_admin hoặc role code TM / TEGL
 */
export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  // Kiểm tra quyền: super_admin (system role) hoặc TM / TEGL (role codes)
  const access = auth.resolvedAccess
  const isSuperAdmin = access.role === 'super_admin'
  const roleCodes = (access.userRoles || []).map((r) =>
    String(r).toUpperCase().trim(),
  )
  const hasDashboardRole =
    isSuperAdmin || roleCodes.includes('TM') || roleCodes.includes('TEGL')

  if (!hasDashboardRole) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền xem dashboard BU' },
      { status: 403 },
    )
  }

  const searchParams = request.nextUrl.searchParams
  const simulateEmail = searchParams.get('simulate_email')?.trim()
  const monthParam = searchParams.get('month')?.trim()
  const yearParam = searchParams.get('year')?.trim()
  const trendBU = searchParams.get('trend_bu')?.trim()

  const month = monthParam ? parseInt(monthParam, 10) : null
  const year = yearParam ? parseInt(yearParam, 10) : null

  const client = await pool.connect()
  try {
    // 1. Xác định email mục tiêu để lọc theo cơ sở
    let targetEmail: string | null = null
    let isSimulating = false

    if (isSuperAdmin && simulateEmail) {
      targetEmail = simulateEmail
      isSimulating = true
    } else if (!isSuperAdmin) {
      targetEmail = access.email
    }

    // Lấy danh sách cơ sở được phân quyền của email mục tiêu
    let allowedCenterTokens: Set<string> | null = null
    if (targetEmail) {
      // Đối với super_admin không giả lập thì xem toàn bộ (allowedCenterTokens = null)
      const centers = await getAccessibleCenters(targetEmail)
      allowedCenterTokens = new Set<string>()
      centers.forEach((c) => {
        if (c.full_name) allowedCenterTokens?.add(c.full_name.toLowerCase().trim())
        if (c.short_code) allowedCenterTokens?.add(c.short_code.toLowerCase().trim())
        if (c.region) allowedCenterTokens?.add(c.region.toLowerCase().trim())
      })
    }

    // Query 1: Số lượng giáo viên active theo BU (main_centre)
    const teacherCountResult = await client.query<{
      bu_name: string
      teacher_count: string
    }>(`
      SELECT
        TRIM(COALESCE(NULLIF(main_centre, ''), "Main centre")) AS bu_name,
        COUNT(*) AS teacher_count
      FROM teachers
      WHERE LOWER(TRIM(COALESCE(status, "Status", ''))) NOT IN ('inactive', 'deactive', 'nghỉ')
        AND COALESCE(NULLIF(main_centre, ''), NULLIF("Main centre", '')) IS NOT NULL
        AND LOWER(TRIM(COALESCE(main_centre, "Main centre", ''))) NOT IN ('active', '#n/a', 'ho', 'deactive', 'inactive', 'nghỉ', 'chưa xác định')
      GROUP BY TRIM(COALESCE(NULLIF(main_centre, ''), "Main centre"))
      ORDER BY teacher_count DESC
    `)

    // Query 2: Điểm chuyên sâu trung bình theo BU (main_centre của giáo viên)
    const queryParams: any[] = []
    let whereClause = `
      WHERE r.diem IS NOT NULL
        AND LOWER(TRIM(COALESCE(t.status, t."Status", ''))) NOT IN ('inactive', 'deactive', 'nghỉ')
        AND COALESCE(NULLIF(t.main_centre, ''), NULLIF(t."Main centre", '')) IS NOT NULL
        AND LOWER(TRIM(COALESCE(t.main_centre, t."Main centre", ''))) NOT IN ('active', '#n/a', 'ho', 'deactive', 'inactive', 'nghỉ', 'chưa xác định')
    `
    if (month && year) {
      queryParams.push(month, year)
      whereClause += ` AND r.thang_dk = $1 AND r.nam_dk = $2 `
    }

    const expertiseResult = await client.query<{
      bu_name: string
      avg_score: string | null
      participant_count: string
      max_teacher_score: string | null
      max_score_teachers_count: string
    }>(`
      WITH teacher_averages AS (
        SELECT
          TRIM(COALESCE(NULLIF(t.main_centre, ''), t."Main centre")) AS bu_name,
          t.code AS teacher_code,
          TRUNC(AVG(r.diem)::numeric, 2) AS teacher_avg_score
        FROM chuyen_sau_results r
        JOIN teachers t ON (
          LOWER(TRIM(r.ma_giao_vien)) = LOWER(TRIM(t.code))
          OR (r.dia_chi_email IS NOT NULL AND LOWER(TRIM(r.dia_chi_email)) = LOWER(TRIM(t.work_email)))
        )
        ${whereClause}
        GROUP BY TRIM(COALESCE(NULLIF(t.main_centre, ''), t."Main centre")), t.code
      ),
      bu_max_scores AS (
        SELECT
          bu_name,
          MAX(teacher_avg_score) AS max_teacher_score
        FROM teacher_averages
        GROUP BY bu_name
      ),
      bu_max_teachers_count AS (
        SELECT
          ta.bu_name,
          COUNT(*) AS max_score_teachers_count
        FROM teacher_averages ta
        JOIN bu_max_scores bms ON ta.bu_name = bms.bu_name AND ta.teacher_avg_score = bms.max_teacher_score
        GROUP BY ta.bu_name
      ),
      bu_overall_avg AS (
        SELECT
          TRIM(COALESCE(NULLIF(t.main_centre, ''), t."Main centre")) AS bu_name,
          TRUNC(AVG(r.diem)::numeric, 2) AS avg_score,
          COUNT(DISTINCT t.code) AS participant_count
        FROM chuyen_sau_results r
        JOIN teachers t ON (
          LOWER(TRIM(r.ma_giao_vien)) = LOWER(TRIM(t.code))
          OR (r.dia_chi_email IS NOT NULL AND LOWER(TRIM(r.dia_chi_email)) = LOWER(TRIM(t.work_email)))
        )
        ${whereClause}
        GROUP BY TRIM(COALESCE(NULLIF(t.main_centre, ''), t."Main centre"))
      )
      SELECT
        boa.bu_name,
        boa.avg_score,
        boa.participant_count,
        bms.max_teacher_score,
        bmtc.max_score_teachers_count
      FROM bu_overall_avg boa
      LEFT JOIN bu_max_scores bms ON boa.bu_name = bms.bu_name
      LEFT JOIN bu_max_teachers_count bmtc ON boa.bu_name = bmtc.bu_name
    `, queryParams)

    // Merge 2 datasets theo tên BU (fuzzy match: lowercase + trim)
    const expertiseMap = new Map<string, { 
      avg: number | null; 
      participants: number;
      maxTeacherScore: number | null;
      maxScoreTeachersCount: number;
    }>()
    for (const row of expertiseResult.rows) {
      expertiseMap.set(row.bu_name.toLowerCase(), {
        avg: row.avg_score ? parseFloat(row.avg_score) : null,
        participants: parseInt(row.participant_count) || 0,
        maxTeacherScore: row.max_teacher_score ? parseFloat(row.max_teacher_score) : null,
        maxScoreTeachersCount: parseInt(row.max_score_teachers_count) || 0,
      })
    }

    let metrics: BUMetric[] = teacherCountResult.rows.map((row) => {
      const key = row.bu_name.toLowerCase()
      const expertise = expertiseMap.get(key)
      return {
        bu_name: row.bu_name,
        teacher_count: parseInt(row.teacher_count) || 0,
        avg_expertise_score: expertise?.avg ?? null,
        expertise_participant_count: expertise?.participants ?? 0,
        max_teacher_score: expertise?.maxTeacherScore ?? null,
        max_score_teachers_count: expertise?.maxScoreTeachersCount ?? 0,
      }
    })

    // Thêm các BU chỉ có điểm chuyên sâu nhưng không có GV trong teachers
    for (const [key, expertise] of expertiseMap.entries()) {
      const alreadyIncluded = metrics.some(
        (m) => m.bu_name.toLowerCase() === key,
      )
      if (!alreadyIncluded) {
        const originalRow = expertiseResult.rows.find(
          (r) => r.bu_name.toLowerCase() === key,
        )
        if (originalRow) {
          metrics.push({
            bu_name: originalRow.bu_name,
            teacher_count: 0,
            avg_expertise_score: expertise.avg,
            expertise_participant_count: expertise.participants,
            max_teacher_score: expertise.maxTeacherScore,
            max_score_teachers_count: expertise.maxScoreTeachersCount,
          })
        }
      }
    }

    // Lọc theo phân quyền cơ sở nếu có token
    if (allowedCenterTokens) {
      metrics = metrics.filter((m) => {
        const buLower = m.bu_name.toLowerCase().trim()
        // Xem tên BU có khớp với center full_name, short_code hoặc region được phân quyền không
        for (const token of allowedCenterTokens!) {
          if (buLower.includes(token) || token.includes(buLower)) {
            return true
          }
        }
        return false
      })
    }

    // Sắp xếp: BU nhiều GV nhất lên đầu
    metrics.sort((a, b) => b.teacher_count - a.teacher_count)

    // Lấy danh sách các Manager (TM / TEGL) để Super Admin mô phỏng
    let managers: SimulatibleManager[] = []
    if (isSuperAdmin) {
      const managersRes = await client.query<SimulatibleManager>(`
        SELECT DISTINCT u.email, u.display_name, ur.role_code
        FROM app_users u
        JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.role_code IN ('TM', 'TEGL')
        ORDER BY ur.role_code DESC, u.display_name ASC
      `)
      managers = managersRes.rows
    }

    // Lấy danh sách tháng/năm có dữ liệu để frontend làm bộ lọc
    const monthsResult = await client.query<{
      thang_dk: number
      nam_dk: number
    }>(`
      SELECT DISTINCT thang_dk, nam_dk
      FROM chuyen_sau_results
      WHERE thang_dk IS NOT NULL AND nam_dk IS NOT NULL
      ORDER BY nam_dk DESC, thang_dk DESC
    `)
    const availableMonths = monthsResult.rows.map(r => ({
      month: r.thang_dk,
      year: r.nam_dk
    }))

    // Query 3: Xu hướng điểm chuyên sâu qua các tháng (Toàn hệ thống hoặc theo BU cụ thể)
    const trendQueryParams: any[] = []
    let trendWhereClause = `
      WHERE r.diem IS NOT NULL
        AND LOWER(TRIM(COALESCE(t.status, t."Status", ''))) NOT IN ('inactive', 'deactive', 'nghỉ')
        AND COALESCE(NULLIF(t.main_centre, ''), NULLIF(t."Main centre", '')) IS NOT NULL
        AND LOWER(TRIM(COALESCE(t.main_centre, t."Main centre", ''))) NOT IN ('active', '#n/a', 'ho', 'deactive', 'inactive', 'nghỉ', 'chưa xác định')
    `
    if (trendBU && trendBU !== 'all' && trendBU !== '') {
      trendQueryParams.push(trendBU)
      trendWhereClause += ` AND TRIM(COALESCE(NULLIF(t.main_centre, ''), t."Main centre")) = $1 `
    }

    const trendResult = await client.query<{
      nam_dk: number
      thang_dk: number
      avg_score: string | null
      participant_count: string
    }>(`
      SELECT
        r.nam_dk,
        r.thang_dk,
        TRUNC(AVG(r.diem)::numeric, 2) AS avg_score,
        COUNT(DISTINCT t.code) AS participant_count
      FROM chuyen_sau_results r
      JOIN teachers t ON (
        LOWER(TRIM(r.ma_giao_vien)) = LOWER(TRIM(t.code))
        OR (r.dia_chi_email IS NOT NULL AND LOWER(TRIM(r.dia_chi_email)) = LOWER(TRIM(t.work_email)))
      )
      ${trendWhereClause}
      GROUP BY r.nam_dk, r.thang_dk
      ORDER BY r.nam_dk ASC, r.thang_dk ASC
    `, trendQueryParams)
    const trendData = trendResult.rows.map(r => ({
      month: `${String(r.thang_dk).padStart(2, '0')}/${r.nam_dk}`,
      avg_score: r.avg_score ? parseFloat(r.avg_score) : null,
      participant_count: parseInt(r.participant_count) || 0
    }))

    return NextResponse.json({
      success: true,
      data: metrics,
      total_bu: metrics.length,
      total_teachers: metrics.reduce((s, m) => s + m.teacher_count, 0),
      managers: isSuperAdmin ? managers : undefined,
      simulated: isSimulating ? { email: targetEmail } : null,
      available_months: availableMonths,
      trend_data: trendData,
    })
  } catch (error) {
    console.error('[BU Metrics API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Lỗi không xác định',
      },
      { status: 500 },
    )
  } finally {
    client.release()
  }
})
