import { requireBearerDbRoles, requireBearerSuperAdmin } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: Get roles for a user
export async function GET(request: NextRequest) {
    try {
        const listGate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
        if (!listGate.ok) return listGate.response;

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId là bắt buộc' }, { status: 400 });
        }

        const result = await pool.query(`
      SELECT ur.role_code, r.role_name, r.description, r.department
      FROM user_roles ur
      JOIN roles r ON r.role_code = ur.role_code
      WHERE ur.user_id = $1
      ORDER BY r.department, r.role_name
    `, [userId]);

        return NextResponse.json({ roles: result.rows });
    } catch (error: any) {
        console.error('Error getting user roles:', error);
        return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
    }
}

// POST: Set roles for a user (replaces all existing)
export async function POST(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdmin(request);
        if (!gate.ok) return gate.response;

        const { userId, roleCodes } = await request.json();

        if (!userId || !Array.isArray(roleCodes)) {
            return NextResponse.json(
                { error: 'userId và roleCodes array là bắt buộc' },
                { status: 400 }
            );
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

            if (roleCodes.length > 0) {
                const values = roleCodes
                    .map((_: string, i: number) => `($1, $${i + 2})`)
                    .join(', ');
                await client.query(
                    `INSERT INTO user_roles (user_id, role_code) VALUES ${values}`,
                    [userId, ...roleCodes]
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, count: roleCodes.length });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error setting user roles:', error);
        return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
    }
}
