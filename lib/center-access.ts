import pool from '@/lib/db'

let teachingLeadersHasAreasColumn: boolean | null = null

async function getTeachingLeadersHasAreasColumn(): Promise<boolean> {
  if (teachingLeadersHasAreasColumn !== null) return teachingLeadersHasAreasColumn

  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'teaching_leaders'
         AND column_name = 'areas'
       LIMIT 1`,
    )
    teachingLeadersHasAreasColumn = (result.rowCount ?? 0) > 0
  } catch {
    teachingLeadersHasAreasColumn = false
  }

  return teachingLeadersHasAreasColumn
}

type CenterRow = {
  id: number
  full_name: string
  short_code: string | null
  region: string | null
  email: string | null
}

function dedupeCenters(rows: CenterRow[]) {
  const seen = new Set<number>()
  return rows.filter((center) => {
    if (seen.has(center.id)) return false
    seen.add(center.id)
    return true
  })
}

function sortCenters(rows: CenterRow[]) {
  return rows.sort((a, b) => a.full_name.localeCompare(b.full_name))
}

async function queryLeaderCenters(email: string): Promise<CenterRow[]> {
  const hasAreas = await getTeachingLeadersHasAreasColumn()
  const leaderQuery = hasAreas
    ? `SELECT DISTINCT c.id, c.full_name, c.short_code, c.region, c.email
       FROM teaching_leaders tl
       JOIN centers c ON c.region = ANY(
         COALESCE(
           (SELECT ARRAY(SELECT jsonb_array_elements_text(tl.areas))
            WHERE tl.areas IS NOT NULL AND jsonb_typeof(tl.areas) = 'array'),
           string_to_array(COALESCE(tl.area, ''), ',')
         )
       )
       WHERE LOWER(TRIM(tl.email)) = $1
         AND tl.status = 'Active'
       ORDER BY c.full_name`
    : `SELECT DISTINCT c.id, c.full_name, c.short_code, c.region, c.email
       FROM teaching_leaders tl
       JOIN centers c ON c.region = ANY(
         string_to_array(COALESCE(tl.area, ''), ',')
       )
       WHERE LOWER(TRIM(tl.email)) = $1
         AND tl.status = 'Active'
       ORDER BY c.full_name`

  const result = await pool.query(leaderQuery, [email])
  return result.rows as CenterRow[]
}

/**
 * Get list of centers accessible by a user.
 * - super_admin: all centers
 * - admin/manager: only assigned centers
 * - others: no centers
 */
export async function getAccessibleCenters(
  email: string | undefined | null,
): Promise<
  Array<{
    id: number
    full_name: string
    short_code: string | null
    region: string | null
    email: string | null
  }>
> {
  if (!email?.trim()) return []

  const normalized = email.trim().toLowerCase()

  try {
    const userResult = await pool.query(
      `SELECT id, role FROM app_users WHERE email = $1 AND is_active = true`,
      [normalized],
    )

    const appUser = userResult.rows[0] as { id: number; role: string } | undefined

    if (!appUser) {
      const leaderCenters = await queryLeaderCenters(normalized)
      return dedupeCenters(leaderCenters).sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      )
    }

    if (appUser.role === 'super_admin') {
      const allCenters = await pool.query(
        `SELECT id, full_name, short_code, region, email
         FROM centers
         WHERE status = 'Active'
         ORDER BY full_name`,
      )

      return allCenters.rows as CenterRow[]
    }

    const [managerCenters, leaderCenters] = await Promise.all([
      pool.query(
        `SELECT DISTINCT c.id, c.full_name, c.short_code, c.region, c.email
         FROM manager_centers mc
         JOIN centers c ON c.id = mc.center_id
         WHERE mc.user_id = $1 AND c.status = 'Active'
         ORDER BY c.full_name`,
        [appUser.id],
      ),
      queryLeaderCenters(normalized),
    ])

    return sortCenters(
      dedupeCenters([
        ...(managerCenters.rows as CenterRow[]),
        ...leaderCenters,
      ]),
    )
  } catch (e) {
    console.error('getAccessibleCenters:', e)
    return []
  }
}

/**
 * Check if user can access a specific center
 */
export async function canAccessCenter(
  email: string | undefined | null,
  centerId: number,
): Promise<boolean> {
  const centers = await getAccessibleCenters(email)
  return centers.some((c) => c.id === centerId)
}

/**
 * Get center IDs accessible by user (for filtering queries)
 */
export async function getAccessibleCenterIds(
  email: string | undefined | null,
): Promise<number[]> {
  const centers = await getAccessibleCenters(email)
  return centers.map((c) => c.id)
}
