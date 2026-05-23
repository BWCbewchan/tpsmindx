import { requireBearerDbRoles } from '@/lib/auth-server'
import { getAccessibleCenters } from '@/lib/center-access'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Mapping region → group (giống centers-by-user)
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

// Lấy tất cả region trong cùng group với region đầu vào
function getGroupRegions(region: string): string[] {
  const group = REGION_GROUPS[region]
  if (!group) return [region]
  return Object.entries(REGION_GROUPS)
    .filter(([, g]) => g === group)
    .map(([r]) => r)
}

type AccessibleCenter = {
  id: number
  full_name: string
  short_code: string | null
}

type CenterData = {
  full_name: string
  region: string
  uu_tien: { ma_gv: string; teacher_name: string; gio_bat_dau: string; gio_ket_thuc: string; khoi_final: string | null }[]
  linh_hoat: { ma_gv: string; teacher_name: string; gio_bat_dau: string; gio_ket_thuc: string; khoi_final: string | null }[]
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function buildAllowedCenterKeys(centers: AccessibleCenter[]): Set<string> {
  return new Set(
    centers
      .flatMap((center) => [center.short_code ?? '', center.full_name])
      .map(normalizeKey)
      .filter(Boolean),
  )
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, [
      'super_admin',
      'admin',
      'manager',
    ])
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!date || !from || !to) {
      return NextResponse.json(
        { success: false, error: 'Thiếu date, from, to' },
        { status: 400 },
      )
    }

    const allowedCenterKeys =
      gate.role === 'super_admin'
        ? null
        : buildAllowedCenterKeys(
            (await getAccessibleCenters(gate.sessionEmail)) as AccessibleCenter[],
          )

    if (gate.role !== 'super_admin' && !allowedCenterKeys?.size) {
      return NextResponse.json({ success: true, data: [] })
    }

    // 1. Lấy tất cả lịch rảnh overlap khung giờ, kèm main_centre của teacher
    const lichResult = await pool.query(
      `SELECT
         d.id, d.ma_gv, d.co_so_uu_tien, d.linh_hoat,
         d.gio_bat_dau, d.gio_ket_thuc,
         t.full_name AS teacher_name,
         COALESCE(t.main_centre, t."Main centre", t.centers) AS main_centre,
         t.khoi_final
       FROM dangky_lich_lam d
       LEFT JOIN teachers t ON LOWER(TRIM(t.code)) = LOWER(TRIM(d.ma_gv))
       WHERE TO_CHAR(d.ngay, 'YYYY-MM-DD') = $1
         AND d.gio_bat_dau < $2::time
         AND d.gio_ket_thuc > $3::time
       ORDER BY d.ma_gv`,
      [date, to, from],
    )

    // 2. Lấy tất cả cơ sở active kèm region
    const centersResult = await pool.query(
      `SELECT short_code, full_name, region FROM centers WHERE status = 'Active' ORDER BY region, full_name`,
    )
    const allCenters = centersResult.rows

    // 3. Lookup region của main_centre từng user
    const mainCentreRegionCache: Record<string, string | null> = {}
    for (const row of lichResult.rows) {
      const mc = row.main_centre?.trim()
      if (!mc || mainCentreRegionCache[mc] !== undefined) continue
      // Match exact full_name, hoặc short_code, hoặc ILIKE partial
      const r = await pool.query(
        `SELECT region FROM centers 
         WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
            OR LOWER(TRIM(short_code)) = LOWER(TRIM($1))
            OR LOWER(TRIM(full_name)) ILIKE '%' || LOWER(TRIM($1)) || '%'
            OR LOWER(TRIM($1)) ILIKE '%' || LOWER(TRIM(full_name)) || '%'
         ORDER BY 
           CASE WHEN LOWER(TRIM(full_name)) = LOWER(TRIM($1)) THEN 0
                WHEN LOWER(TRIM(short_code)) = LOWER(TRIM($1)) THEN 1
                ELSE 2 END
         LIMIT 1`,
        [mc]
      )
      mainCentreRegionCache[mc] = r.rows[0]?.region?.trim() || null
    }

    // 4. Build center map
    type CenterData = {
      full_name: string
      region: string
      uu_tien: { ma_gv: string; teacher_name: string; gio_bat_dau: string; gio_ket_thuc: string; khoi_final: string | null; main_centre_region: string | null }[]
      linh_hoat: { ma_gv: string; teacher_name: string; gio_bat_dau: string; gio_ket_thuc: string; khoi_final: string | null; main_centre_region: string | null }[]
    }
    const centerMap: Record<string, CenterData> = {}
    allCenters.forEach((c: { short_code: string; full_name: string; region: string }) => {
      centerMap[c.short_code] = {
        full_name: c.full_name,
        region: c.region,
        uu_tien: [],
        linh_hoat: [],
      }
    })

    // 5. Phân loại
    lichResult.rows.forEach((row: {
      ma_gv: string
      co_so_uu_tien: string[] | null
      linh_hoat: boolean | null
      teacher_name: string | null
      gio_bat_dau: string
      gio_ket_thuc: string
      khoi_final: string | null
      main_centre: string | null
    }) => {
      const uuTien: string[] = row.co_so_uu_tien || []
      const isLinhHoat: boolean = row.linh_hoat || false
      const mentor = {
        ma_gv: row.ma_gv,
        teacher_name: row.teacher_name || row.ma_gv,
        gio_bat_dau: String(row.gio_bat_dau || '').slice(0, 5),
        gio_ket_thuc: String(row.gio_ket_thuc || '').slice(0, 5),
        khoi_final: row.khoi_final || null,
        main_centre_region: mainCentreRegionCache[row.main_centre?.trim() ?? ''] || null
      }

      // Ưu tiên: thêm vào các cơ sở đã chọn
      uuTien.forEach((cs) => {
        if (centerMap[cs] && !centerMap[cs].uu_tien.find((m) => m.ma_gv === mentor.ma_gv)) {
          centerMap[cs].uu_tien.push(mentor)
        }
      })

      // Linh hoạt: chỉ apply cho cơ sở trong cùng region group với main_centre của user
      if (isLinhHoat) {
        const mc = row.main_centre?.trim()
        const userRegion = mc ? mainCentreRegionCache[mc] : null
        const groupRegions = userRegion ? getGroupRegions(userRegion) : []

        Object.keys(centerMap).forEach((cs) => {
          // Chỉ apply nếu cơ sở đó thuộc cùng group region với user
          if (!groupRegions.includes(centerMap[cs].region)) return
          // Không apply nếu đã là uu_tien
          if (uuTien.includes(cs)) return
          if (!centerMap[cs].linh_hoat.find((m) => m.ma_gv === mentor.ma_gv)) {
            centerMap[cs].linh_hoat.push(mentor)
          }
        })
      }
    })

    // 6. Chỉ trả về cơ sở có người và thuộc phạm vi center được gán
    const result = Object.entries(centerMap)
      .filter(([, v]) => v.uu_tien.length > 0 || v.linh_hoat.length > 0)
      .filter(([short_code, v]) => {
        if (!allowedCenterKeys) return true
        return (
          allowedCenterKeys.has(normalizeKey(short_code)) ||
          allowedCenterKeys.has(normalizeKey(v.full_name))
        )
      })
      .map(([short_code, v]) => ({
        short_code,
        full_name: v.full_name,
        region: v.region,
        uu_tien: v.uu_tien,
        linh_hoat: v.linh_hoat,
        total: v.uu_tien.length + v.linh_hoat.length,
      }))
      .sort((a, b) => a.region.localeCompare(b.region) || a.full_name.localeCompare(b.full_name))

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Error in admin lich-lam-viec:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}