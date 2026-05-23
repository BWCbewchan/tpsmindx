import { findMatchingCampus, normalizeText } from '@/lib/campus-data'
import { resolveCenterBuEmail } from '@/lib/center-bu-email-fallback'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type CenterRow = {
  id: number
  full_name: string
  short_code: string | null
  display_name: string | null
  email: string | null
  region: string | null
}

async function findCenterRowByCampusLabel(
  label: string,
): Promise<CenterRow | undefined> {
  const trimmed = label.trim()
  if (!trimmed) return undefined

  const direct = await pool.query<CenterRow>(
    `SELECT id, full_name, short_code, display_name, email, region
     FROM centers
     WHERE status = 'Active'
       AND (
         LOWER(TRIM(full_name)) = LOWER(TRIM($1))
         OR LOWER(TRIM(COALESCE(display_name, ''))) = LOWER(TRIM($1))
         OR LOWER(TRIM(COALESCE(short_code, ''))) = LOWER(TRIM($1))
       )
     LIMIT 1`,
    [trimmed],
  )
  if (direct.rows[0]) return direct.rows[0]

  const nTarget = normalizeText(trimmed)

  const all = await pool.query<CenterRow>(
    `SELECT id, full_name, short_code, display_name, email, region
     FROM centers
     WHERE status = 'Active'`,
  )

  const pickByNorm = (n: string) =>
    n
      ? all.rows.find((row) => {
          const nFull = normalizeText(row.full_name)
          const nDisp = normalizeText(row.display_name || '')
          const nShort = normalizeText(row.short_code || '')
          return nFull === n || nDisp === n || nShort === n
        })
      : undefined

  if (nTarget) {
    const byNorm = pickByNorm(nTarget)
    if (byNorm) return byNorm
  }

  const canon = findMatchingCampus(trimmed)
  if (canon?.trim()) {
    const cTrim = canon.trim()
    if (cTrim.toLowerCase() !== trimmed.toLowerCase()) {
      const directCanon = await pool.query<CenterRow>(
        `SELECT id, full_name, short_code, display_name, email, region
         FROM centers
         WHERE status = 'Active'
           AND (
             LOWER(TRIM(full_name)) = LOWER(TRIM($1))
             OR LOWER(TRIM(COALESCE(display_name, ''))) = LOWER(TRIM($1))
             OR LOWER(TRIM(COALESCE(short_code, ''))) = LOWER(TRIM($1))
           )
         LIMIT 1`,
        [cTrim],
      )
      if (directCanon.rows[0]) return directCanon.rows[0]
      const nCanon = normalizeText(canon)
      const byCanonNorm = pickByNorm(nCanon)
      if (byCanonNorm) return byCanonNorm
    }
  }

  return undefined
}

/**
 * Danh bạ gửi mail xin nghỉ — tham chiếu giống /admin/user-management (Centers & Leaders):
 *
 * 1) **manager_centers + app_users**: user được gán quản lý đúng `center_id` (Gán trực tiếp).
 * 2) **teaching_leaders**:
 *    - `center` trùng full_name / short_code / display_name (cả chuỗi hoặc từng phần sau dấu phẩy/chấm phẩy/| — một leader có thể liệt kê nhiều cơ sở).
 *    - **Khu vực** (giống vùng pool + thẻ cơ sở): `area` / `areas` chứa `centers.region` VÀ
 *      (`center` rỗng = ban QL khu vực HOẶC token `center` trùng cơ sở đang chọn).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const centerIdRaw = request.nextUrl.searchParams.get('centerId')
    const fullNameParam = request.nextUrl.searchParams.get('fullName')?.trim()

    const centerId = centerIdRaw ? Number(centerIdRaw) : NaN

    let center: CenterRow | undefined

    if (Number.isFinite(centerId) && centerId > 0) {
      const r = await pool.query<CenterRow>(
        `SELECT id, full_name, short_code, display_name, email, region
         FROM centers
         WHERE id = $1 AND status = 'Active'
         LIMIT 1`,
        [centerId],
      )
      center = r.rows[0]
    } else if (fullNameParam) {
      center = await findCenterRowByCampusLabel(fullNameParam)
    }

    if (!center) {
      return NextResponse.json({
        success: true,
        center: null,
        buEmail: null,
        contacts: [] as Array<{
          role_code: string
          role_name: string | null
          full_name: string
          email: string
        }>,
      })
    }

    const regionNorm = center.region?.trim() || null

    type ContactRow = {
      role_code: string
      role_name: string | null
      full_name: string
      email: string
    }

    const leaders = await pool.query<ContactRow>(
      `SELECT DISTINCT ON (LOWER(TRIM(tl.email)), tl.role_code)
         tl.role_code, tl.role_name, tl.full_name, tl.email
       FROM teaching_leaders tl
       WHERE tl.status = 'Active'
         AND tl.email IS NOT NULL
         AND TRIM(tl.email) <> ''
         AND (
           LOWER(TRIM(COALESCE(tl.center, ''))) = LOWER(TRIM($1::text))
           OR ($2::text IS NOT NULL
             AND LOWER(TRIM(COALESCE(tl.center, ''))) = LOWER(TRIM($2::text)))
           OR ($3::text IS NOT NULL
             AND LOWER(TRIM(COALESCE(tl.center, ''))) = LOWER(TRIM($3::text)))
           OR EXISTS (
             SELECT 1
             FROM unnest(
               string_to_array(
                 REPLACE(REPLACE(REPLACE(COALESCE(tl.center, ''), ';', ','), '|', ','), '／', ','),
                 ','
               )
             ) AS cx(x)
             WHERE LENGTH(TRIM(x)) > 0
               AND (
                 LOWER(TRIM(x)) = LOWER(TRIM($1::text))
                 OR ($2::text IS NOT NULL AND LOWER(TRIM(x)) = LOWER(TRIM($2::text)))
                 OR ($3::text IS NOT NULL AND LOWER(TRIM(x)) = LOWER(TRIM($3::text)))
               )
           )
           OR (
             $4::text IS NOT NULL
             AND LENGTH(TRIM($4::text)) > 0
             AND (
               LOWER(TRIM(COALESCE(tl.area, ''))) = LOWER(TRIM($4::text))
               OR EXISTS (
                 SELECT 1
                 FROM unnest(string_to_array(COALESCE(tl.area, ''), ',')) AS ax(x)
                 WHERE LENGTH(TRIM(x)) > 0
                   AND LOWER(TRIM(x)) = LOWER(TRIM($4::text))
               )
               OR COALESCE(tl.areas, '[]'::jsonb) @> jsonb_build_array(trim($4::text))
               OR EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements_text(COALESCE(tl.areas, '[]'::jsonb)) AS jx(x)
                 WHERE LENGTH(TRIM(x)) > 0
                   AND LOWER(TRIM(x)) = LOWER(TRIM($4::text))
               )
             )
             AND (
               TRIM(COALESCE(tl.center, '')) = ''
               OR LOWER(TRIM(COALESCE(tl.center, ''))) = LOWER(TRIM($1::text))
               OR ($2::text IS NOT NULL
                 AND LOWER(TRIM(COALESCE(tl.center, ''))) = LOWER(TRIM($2::text)))
               OR ($3::text IS NOT NULL
                 AND LOWER(TRIM(COALESCE(tl.center, ''))) = LOWER(TRIM($3::text)))
               OR EXISTS (
                 SELECT 1
                 FROM unnest(
                   string_to_array(
                     REPLACE(REPLACE(REPLACE(COALESCE(tl.center, ''), ';', ','), '|', ','), '／', ','),
                     ','
                   )
                 ) AS cx2(x2)
                 WHERE LENGTH(TRIM(x2)) > 0
                   AND (
                     LOWER(TRIM(x2)) = LOWER(TRIM($1::text))
                     OR ($2::text IS NOT NULL AND LOWER(TRIM(x2)) = LOWER(TRIM($2::text)))
                     OR ($3::text IS NOT NULL AND LOWER(TRIM(x2)) = LOWER(TRIM($3::text)))
                   )
               )
             )
           )
         )
       ORDER BY LOWER(TRIM(tl.email)), tl.role_code, tl.full_name`,
      [
        center.full_name,
        center.short_code?.trim() || null,
        center.display_name?.trim() || null,
        regionNorm,
      ],
    )

    const managers = await pool.query<ContactRow>(
      `SELECT DISTINCT ON (LOWER(TRIM(u.email)))
         'MC' AS role_code,
         'Quản lý cơ sở (gán trực tiếp)' AS role_name,
         COALESCE(NULLIF(TRIM(u.display_name), ''), TRIM(u.email)) AS full_name,
         TRIM(u.email) AS email
       FROM manager_centers mc
       JOIN app_users u ON u.id = mc.user_id
       WHERE mc.center_id = $1
         AND COALESCE(u.is_active, true) = true
         AND u.email IS NOT NULL
         AND TRIM(u.email) <> ''
       ORDER BY LOWER(TRIM(u.email)), u.display_name`,
      [center.id],
    )

    const merged: ContactRow[] = []
    const seenEmail = new Set<string>()
    for (const row of leaders.rows) {
      const k = row.email.trim().toLowerCase()
      if (seenEmail.has(k)) continue
      seenEmail.add(k)
      merged.push(row)
    }
    for (const row of managers.rows) {
      const k = row.email.trim().toLowerCase()
      if (seenEmail.has(k)) continue
      seenEmail.add(k)
      merged.push(row)
    }
    merged.sort((a, b) => {
      const rc = a.role_code.localeCompare(b.role_code)
      if (rc !== 0) return rc
      return a.full_name.localeCompare(b.full_name, 'vi')
    })

    const buEmail =
      resolveCenterBuEmail({
        email: center.email,
        short_code: center.short_code,
        full_name: center.full_name,
      }) || null

    return NextResponse.json({
      success: true,
      center: {
        id: center.id,
        full_name: center.full_name,
        short_code: center.short_code,
        display_name: center.display_name,
        region: center.region?.trim() || null,
      },
      buEmail,
      contacts: merged,
    })
  } catch (error: unknown) {
    console.error('leave-requests/center-contacts GET error:', error)
    const message =
      error instanceof Error ? error.message : 'Không thể tải danh bạ cơ sở'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
