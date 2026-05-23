import { requireBearerDbRoles, requireBearerSuperAdmin } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: Get permissions for a user
export async function GET(request: NextRequest) {
    try {
        const listGate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
        if (!listGate.ok) return listGate.response;

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const email = searchParams.get('email');

        if (!userId && !email) {
            return NextResponse.json({ error: 'userId hoặc email là bắt buộc' }, { status: 400 });
        }

        let query: string;
        let params: any[];

        if (email) {
            query = `
        SELECT p.route_path, p.can_access
        FROM app_permissions p
        JOIN app_users u ON u.id = p.user_id
        WHERE u.email = $1 AND u.is_active = true AND p.can_access = true
      `;
            params = [email.toLowerCase()];
        } else {
            query = `
        SELECT route_path, can_access
        FROM app_permissions
        WHERE user_id = $1 AND can_access = true
      `;
            params = [userId];
        }

        const result = await pool.query(query, params);
        const permissions = result.rows.map((r: { route_path: string }) => r.route_path);

        return NextResponse.json({ permissions });
    } catch (error: any) {
        console.error('Error getting permissions:', error);
        return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
    }
}

// POST: Set permissions for a user (replaces all existing)
export async function POST(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdmin(request);
        if (!gate.ok) return gate.response;

        const { userId, permissions } = await request.json();

        if (!userId || !Array.isArray(permissions)) {
            return NextResponse.json(
                { error: 'userId và permissions array là bắt buộc' },
                { status: 400 }
            );
        }

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Remove all existing permissions
            await client.query('DELETE FROM app_permissions WHERE user_id = $1', [userId]);

            // Insert new permissions
            if (permissions.length > 0) {
                const values = permissions
                    .map((_: string, i: number) => `($1, $${i + 2}, true)`)
                    .join(', ');
                const params = [userId, ...permissions];
                await client.query(
                    `INSERT INTO app_permissions (user_id, route_path, can_access) VALUES ${values}`,
                    params
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, count: permissions.length });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error setting permissions:', error);
        return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
    }
}
