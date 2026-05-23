import jwt from 'jsonwebtoken'
import pool from '@/lib/db'
import { getJwtSecret } from '@/lib/jwt-secret'

export type VerifiedSession = {
  email: string
  /** Chỉ có khi đăng nhập app (JWT nội bộ). */
  role?: string
}

/**
 * Xác thực Bearer: JWT app (HS256) hoặc Firebase ID token (Google tokeninfo).
 */
export async function verifyBearerGetSession(
  bearerToken: string,
): Promise<VerifiedSession | null> {
  const token = bearerToken.trim()
  if (!token) return null

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      email?: string
      role?: string
    }
    if (decoded.email && typeof decoded.email === 'string') {
      return {
        email: decoded.email.trim().toLowerCase(),
        role: decoded.role,
      }
    }
  } catch {
    // Không phải JWT app
  }

  const fbEmail = await verifyFirebaseIdTokenEmail(token)
  if (fbEmail) return { email: fbEmail }
  return null
}

async function verifyFirebaseIdTokenEmail(
  idToken: string,
): Promise<string | null> {
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
    return email || null
  } catch {
    return null
  }
}

/**
 * Admin / manager (hoặc quyền route /admin) mới tra cứu GV theo email/code tùy ý.
 */
export async function userCanLookupAnyTeacher(
  sessionEmail: string,
): Promise<boolean> {
  const normalized = sessionEmail.trim().toLowerCase()
  try {
    const dbResult = await pool.query(
      `SELECT id, role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
      [normalized],
    )
    if (dbResult.rows.length === 0) return false
    const appUser = dbResult.rows[0] as { id: number; role: string }
    if (['super_admin', 'admin', 'manager'].includes(appUser.role)) return true

    const roleCodesRes = await pool.query(
      `SELECT UPPER(role_code::text) AS code FROM user_roles WHERE user_id = $1`,
      [appUser.id],
    )
    const roleCodes = roleCodesRes.rows.map((r: { code: string }) => r.code)
    if (roleCodes.some((c) => c === 'HR' || c === 'TE' || c === 'TF')) return true

    const directPerms = await pool.query(
      `SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true`,
      [appUser.id],
    )
    const rolePerms = await pool.query(
      `SELECT DISTINCT rp.route_path
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_code = ur.role_code
       WHERE ur.user_id = $1`,
      [appUser.id],
    )
    const paths = [
      ...directPerms.rows.map((r: { route_path: string }) => r.route_path),
      ...rolePerms.rows.map((r: { route_path: string }) => r.route_path),
    ]
    return paths.some((p) => p.startsWith('/admin'))
  } catch {
    return false
  }
}

export function teacherRowWorkEmail(row: Record<string, unknown>): string {
  const a = row.work_email
  const b = row['Work email']
  return String(a ?? b ?? '')
    .trim()
    .toLowerCase()
}
