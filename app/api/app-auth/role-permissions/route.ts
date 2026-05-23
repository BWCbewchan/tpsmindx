import { requireBearerDbRoles, requireBearerSuperAdmin } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: Get all roles with their permissions
export async function GET(request: NextRequest) {
    try {
        const listGate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
        if (!listGate.ok) return listGate.response;

        const { searchParams } = new URL(request.url);
        const roleCode = searchParams.get('roleCode');

        if (roleCode) {
            // Get permissions for a specific role
            const result = await pool.query(
                'SELECT route_path FROM role_permissions WHERE role_code = $1',
                [roleCode]
            );
            return NextResponse.json({
                roleCode,
                permissions: result.rows.map((r: { route_path: string }) => r.route_path),
            });
        }

        // Get all roles with their permission counts and routes
        const result = await pool.query(`
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
    `);

        return NextResponse.json({ roles: result.rows });
    } catch (error: any) {
        console.error('Error getting role permissions:', error);
        return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
    }
}

// POST: Set permissions for a role (replaces all existing)
export async function POST(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdmin(request);
        if (!gate.ok) return gate.response;

        const { roleCode, permissions } = await request.json();

        if (!roleCode || !Array.isArray(permissions)) {
            return NextResponse.json(
                { error: 'roleCode và permissions array là bắt buộc' },
                { status: 400 }
            );
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Remove all existing permissions for this role
            await client.query('DELETE FROM role_permissions WHERE role_code = $1', [roleCode]);

            // Insert new permissions
            if (permissions.length > 0) {
                const values = permissions
                    .map((_: string, i: number) => `($1, $${i + 2})`)
                    .join(', ');
                await client.query(
                    `INSERT INTO role_permissions (role_code, route_path) VALUES ${values}`,
                    [roleCode, ...permissions]
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, roleCode, count: permissions.length });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error setting role permissions:', error);
        return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
    }
}

// PUT: Create a new role
export async function PUT(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdmin(request);
        if (!gate.ok) return gate.response;

        const { roleCode, roleName, department, description } = await request.json();

        if (!roleCode || !roleName || !department) {
            return NextResponse.json(
                { error: 'Mã Role, Tên Role và Phòng Ban là bắt buộc' },
                { status: 400 }
            );
        }

        const normalizedCode = roleCode.trim().toUpperCase();

        const existing = await pool.query('SELECT role_code FROM roles WHERE role_code = $1', [normalizedCode]);
        if (existing.rows.length > 0) {
            return NextResponse.json({ error: 'Mã Role này đã tồn tại' }, { status: 409 });
        }

        await pool.query(
            `INSERT INTO roles (role_code, role_name, department, description) VALUES ($1, $2, $3, $4)`,
            [normalizedCode, roleName.trim(), department.trim(), description?.trim() || '']
        );

        return NextResponse.json({ success: true, roleCode: normalizedCode });
    } catch (error: any) {
        console.error('Error creating role:', error);
        return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
    }
}

// PATCH: Update role metadata from reference-data management
export async function PATCH(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdmin(request);
        if (!gate.ok) return gate.response;

        const { roleCode, roleName, department, description } = await request.json();

        if (!roleCode || !roleName || !department) {
            return NextResponse.json(
                { error: 'roleCode, roleName và department là bắt buộc' },
                { status: 400 }
            );
        }

        const normalizedCode = String(roleCode).trim().toUpperCase();

        const updated = await pool.query(
            `UPDATE roles
             SET role_name = $2,
                 department = $3,
                 description = $4
             WHERE role_code = $1
             RETURNING role_code, role_name, department, description`,
            [
                normalizedCode,
                String(roleName).trim(),
                String(department).trim(),
                String(description || '').trim(),
            ]
        );

        if (updated.rowCount === 0) {
            return NextResponse.json({ error: 'Không tìm thấy role' }, { status: 404 });
        }

        return NextResponse.json({ success: true, role: updated.rows[0] });
    } catch (error: any) {
        console.error('Error updating role metadata:', error);
        return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
    }
}
