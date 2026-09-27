import { requireBearerDbRoles } from '@/lib/auth-server';
import {
  filterManagementPermissions,
  isManagementPermissionRoute,
} from '@/lib/admin-permission-routes';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function syncAllTeachingLeadersToAppUsers() {
  // Bootstrap new leaders only. Reading this endpoint must never restore revoked
  // roles, reactivate a disabled account, or demote an existing super administrator.
  await pool.query(`
    WITH new_users AS (
      INSERT INTO app_users (email, display_name, role, auth_type, is_active, created_by)
      SELECT DISTINCT ON (LOWER(TRIM(tl.email)))
        LOWER(TRIM(tl.email)), tl.full_name, 'manager', 'firebase',
        CASE WHEN tl.status = 'Deactive' THEN false ELSE true END, 'teaching_leaders-sync'
      FROM teaching_leaders tl
      WHERE tl.email IS NOT NULL AND trim(tl.email) <> ''
      ORDER BY LOWER(TRIM(tl.email)), tl.code
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email
    )
    INSERT INTO user_roles (user_id, role_code)
    SELECT nu.id, tl.role_code FROM new_users nu
    JOIN teaching_leaders tl ON LOWER(TRIM(tl.email)) = nu.email
    JOIN roles r ON r.role_code = tl.role_code
    ON CONFLICT (user_id, role_code) DO NOTHING
  `);

}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, ['super_admin', 'admin'])
    if (!gate.ok) return gate.response

    await syncAllTeachingLeadersToAppUsers()

    const [rolesRes, centersRes, areasRes, usersRes] = await Promise.all([
      pool.query(`
        SELECT r.role_code, r.role_name, r.description, r.department,
          COALESCE(
            json_agg(rp.route_path) FILTER (WHERE rp.id IS NOT NULL),
            '[]'
          ) as permissions,
          COUNT(rp.id)::int as permission_count
        FROM roles r
        LEFT JOIN role_permissions rp ON r.role_code = rp.role_code
        GROUP BY r.role_code, r.role_name, r.description, r.department
        ORDER BY r.department, r.role_name
      `),
      pool.query(`
        SELECT id, region, short_code, full_name, display_name, status
        FROM centers
        ORDER BY region, full_name
      `),
      pool.query(`
        WITH leader_areas AS (
          SELECT DISTINCT trim(x) AS area
          FROM (
            SELECT area AS x
            FROM teaching_leaders
            WHERE area IS NOT NULL AND trim(area) <> ''
            UNION ALL
            SELECT jsonb_array_elements_text(areas) AS x
            FROM teaching_leaders
            WHERE areas IS NOT NULL
              AND jsonb_typeof(areas) = 'array'
              AND jsonb_array_length(areas) > 0
          ) t
          WHERE trim(x) <> ''
        ),
        center_regions AS (
          SELECT DISTINCT trim(region) AS area
          FROM centers
          WHERE region IS NOT NULL AND trim(region) <> ''
        )
        SELECT DISTINCT area
        FROM (
          SELECT area FROM leader_areas
          UNION
          SELECT area FROM center_regions
        ) u
        ORDER BY area
      `),
      pool.query(`
        SELECT u.id, u.email, u.display_name, u.role, u.is_active, u.created_by, u.created_at,
          COALESCE(u.auth_type, 'app') as auth_type,
          COALESCE(
            (SELECT json_agg(json_build_object('route_path', p.route_path, 'can_access', p.can_access))
             FROM app_permissions p WHERE p.user_id = u.id),
            '[]'
          ) as permissions,
          COALESCE(
            (SELECT json_agg(ur.role_code)
             FROM user_roles ur WHERE ur.user_id = u.id),
            '[]'
          ) as user_roles
        FROM app_users u
        ORDER BY u.created_at DESC
      `),
    ])

    return NextResponse.json({
      success: true,
      roles: rolesRes.rows.map((row) => {
        const permissions = filterManagementPermissions(
          Array.isArray(row.permissions) ? row.permissions : [],
        )
        return {
          ...row,
          permissions,
          permission_count: permissions.length,
        }
      }),
      centers: centersRes.rows,
      areas: areasRes.rows.map((r: { area: string }) => r.area),
      users: usersRes.rows.map((row) => ({
        ...row,
        permissions: Array.isArray(row.permissions)
          ? row.permissions.filter((permission: { route_path: string }) =>
              isManagementPermissionRoute(permission.route_path),
            )
          : [],
      })),
    })
  } catch (error: unknown) {
    console.error('Error getting reference-data:', error)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
