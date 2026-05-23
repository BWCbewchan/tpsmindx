import { requireBearerDbRoles } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function syncAllTeachingLeadersToAppUsers() {
  // First sync users
  await pool.query(
    `INSERT INTO app_users (email, display_name, role, auth_type, is_active, created_by)
     SELECT LOWER(TRIM(email)), full_name, 'manager', 'firebase',
       CASE WHEN status = 'Deactive' THEN false ELSE true END,
       'teaching_leaders-sync'
     FROM teaching_leaders
     WHERE email IS NOT NULL AND trim(email) <> ''
     ON CONFLICT (email) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       role = 'manager',
       auth_type = EXCLUDED.auth_type,
       is_active = EXCLUDED.is_active,
       created_by = EXCLUDED.created_by`,
  );

  // Then assign roles
  await pool.query(
    `INSERT INTO user_roles (user_id, role_code)
     SELECT au.id, tl.role_code
     FROM teaching_leaders tl
     JOIN app_users au ON LOWER(TRIM(au.email)) = LOWER(TRIM(tl.email))
     WHERE tl.email IS NOT NULL AND trim(tl.email) <> '' AND tl.role_code IS NOT NULL
     ON CONFLICT (user_id, role_code) DO NOTHING`,
  );
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
      roles: rolesRes.rows,
      centers: centersRes.rows,
      areas: areasRes.rows.map((r: { area: string }) => r.area),
      users: usersRes.rows,
    })
  } catch (error: unknown) {
    console.error('Error getting reference-data:', error)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
