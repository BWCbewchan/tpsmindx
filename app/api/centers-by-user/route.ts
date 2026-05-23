import { getAccessibleCenters } from '@/lib/center-access'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function parseCenterTokens(rawValue: unknown): string[] {
  const value = String(rawValue ?? '').trim()
  if (!value) return []
  return value
    .split(/[,;|\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

// Mapping: region → group (các region cùng nhóm sẽ thấy nhau)
const REGION_GROUPS: Record<string, string> = {
  'HCM 1': 'HCM1_HCM4',
  'HCM 4': 'HCM1_HCM4',
  'HCM 2': 'HCM2_HCM3',
  'HCM 3': 'HCM2_HCM3',
  'TỈNH NAM': 'TINH_NAM',
  'ONLINE': 'ONLINE',
  'HN 1': 'HN1_HN2',
  'HN 2': 'HN1_HN2',
  'TỈNH BẮC': 'TINH_BAC',
  'TỈNH TRUNG': 'TINH_TRUNG',
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const requestedEmail = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    if (!auth.privileged && requestedEmail && requestedEmail !== auth.sessionEmail) {
      return NextResponse.json({ success: false, error: 'Không có quyền xem cơ sở của email này' }, { status: 403 })
    }

    const email = auth.privileged
      ? (requestedEmail || auth.sessionEmail)
      : auth.sessionEmail

    if (!email) {
      return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 400 })
    }

    // 0. Kiểm tra nếu là super_admin → trả về tất cả centers
    const adminCheck = await pool.query(
      `SELECT role FROM app_users WHERE LOWER(TRIM(email)) = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    
    if (adminCheck.rows.length > 0 && adminCheck.rows[0].role === 'super_admin') {
      const allCentersResult = await pool.query(
        `SELECT id, region, short_code, full_name, email
         FROM centers
         WHERE status = 'Active'
         ORDER BY region, full_name`
      )
      return NextResponse.json({
        success: true,
        mainCentre: 'ALL',
        region: 'ALL',
        group: 'ALL',
        isSuperAdmin: true,
        centers: allCentersResult.rows,
      })
    }

    // 1. Lấy main_centre của teacher
    const teacherResult = await pool.query(
      `SELECT COALESCE(main_centre, "Main centre", centers) AS main_centre
       FROM teachers
       WHERE LOWER(TRIM(work_email)) = $1
          OR LOWER(TRIM("Work email")) = $1
       LIMIT 1`,
      [email]
    )

    if (teacherResult.rows.length === 0) {
      return NextResponse.json({ success: true, centers: [], region: null, group: null })
    }

    const mainCentre = teacherResult.rows[0].main_centre?.trim()
    if (!mainCentre) {
      const accessibleCenters = await getAccessibleCenters(email)
      return NextResponse.json({
        success: true,
        mainCentre: null,
        region: null,
        group: null,
        centers: accessibleCenters,
      })
    }

    // 2. Map main_centre → region qua bảng centers
    const candidates = parseCenterTokens(mainCentre)
    const matchedRegions = new Set<string>()

    for (const candidate of candidates) {
      const regionResult = await pool.query(
        `SELECT region FROM centers
         WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
            OR LOWER(TRIM(short_code)) = LOWER(TRIM($1))
            OR LOWER(TRIM(region)) = LOWER(TRIM($1))
            OR LOWER(TRIM(full_name)) ILIKE '%' || LOWER(TRIM($1)) || '%'
            OR LOWER(TRIM(short_code)) ILIKE '%' || LOWER(TRIM($1)) || '%'
            OR LOWER(TRIM(region)) ILIKE '%' || LOWER(TRIM($1)) || '%'
         LIMIT 1`,
        [candidate],
      )
      const regionValue = regionResult.rows[0]?.region?.trim()
      if (regionValue) {
        matchedRegions.add(regionValue)
      }
    }

    if (matchedRegions.size === 0) {
      const accessibleCenters = await getAccessibleCenters(email)
      return NextResponse.json({
        success: true,
        mainCentre,
        region: null,
        group: null,
        centers: accessibleCenters,
      })
    }

    const regions = Array.from(matchedRegions)
    const groupRegions = Array.from(
      new Set(
        regions.flatMap((region) => {
          const group = REGION_GROUPS[region]
          if (!group) return [region]
          return Object.entries(REGION_GROUPS)
            .filter(([, g]) => g === group)
            .map(([r]) => r)
        }),
      ),
    )
    const groupKeys = new Set(regions.map((region) => REGION_GROUPS[region] || region))
    const group = groupKeys.size === 1 ? Array.from(groupKeys)[0] : 'MULTIPLE'
    const region = regions.length === 1 ? regions[0] : null

    // 3. Lấy tất cả cơ sở thuộc các region đó
    const centersResult = await pool.query(
      `SELECT id, region, short_code, full_name, email
       FROM centers
       WHERE region = ANY($1::text[])
         AND status = 'Active'
       ORDER BY region, full_name`,
      [groupRegions]
    )

    return NextResponse.json({
      success: true,
      mainCentre,
      region,
      group,
      centers: centersResult.rows,
    })
  } catch (error: any) {
    console.error('Error in centers-by-user:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
