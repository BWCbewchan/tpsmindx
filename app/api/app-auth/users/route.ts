import {
  requireBearerDbRoles,
  requireBearerSuperAdmin,
} from '@/lib/auth-server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

const APP_USER_ROLES = new Set([
  'super_admin',
  'admin',
  'manager',
  'teacher',
  'hr',
]);

// GET: List all app users — Bearer + DB role super_admin | admin
export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
    if (!gate.ok) return gate.response;

    const result = await pool.query(`
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
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error: unknown) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

// POST: Create new user OR add existing Firebase account — super_admin only
export async function POST(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request);
    if (!gate.ok) return gate.response;

    const { email, password, displayName, role, permissions, userRoles, authType } =
      await request.json();

    const isFirebase = authType === 'firebase';

    if (!email || !displayName) {
      return NextResponse.json(
        { error: 'Email và tên hiển thị là bắt buộc' },
        { status: 400 },
      );
    }

    if (!isFirebase && !password) {
      return NextResponse.json(
        { error: 'Mật khẩu là bắt buộc cho tài khoản app' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM app_users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email đã tồn tại' }, { status: 409 });
    }

    const passwordHash = isFirebase ? null : await bcrypt.hash(password, 10);

    const createdBy = gate.sessionEmail;

    const userResult = await pool.query(
      `INSERT INTO app_users (email, password_hash, display_name, role, created_by, auth_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, display_name, role, is_active, created_at, auth_type`,
      [
        normalizedEmail,
        passwordHash,
        displayName,
        role || 'admin',
        createdBy,
        isFirebase ? 'firebase' : 'app',
      ],
    );

    const newUser = userResult.rows[0];

    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const permValues = permissions
        .map((_: string, i: number) => `($1, $${i + 2}, true)`)
        .join(', ');
      const permParams = [newUser.id, ...permissions];
      await pool.query(
        `INSERT INTO app_permissions (user_id, route_path, can_access) VALUES ${permValues}
         ON CONFLICT (user_id, route_path) DO UPDATE SET can_access = true`,
        permParams,
      );
    }

    if (userRoles && Array.isArray(userRoles) && userRoles.length > 0) {
      const roleValues = userRoles
        .map((_: string, i: number) => `($1, $${i + 2})`)
        .join(', ');
      const roleParams = [newUser.id, ...userRoles];
      await pool.query(
        `INSERT INTO user_roles (user_id, role_code) VALUES ${roleValues} ON CONFLICT DO NOTHING`,
        roleParams,
      );
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi server';
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + msg }, { status: 500 });
  }
}

// PUT: Update user — super_admin only
export async function PUT(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request);
    if (!gate.ok) return gate.response;

    const { id, displayName, role, isActive, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID là bắt buộc' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(displayName);
    }
    if (role !== undefined) {
      if (typeof role !== 'string' || !APP_USER_ROLES.has(role)) {
        return NextResponse.json(
          { error: 'Giá trị role không hợp lệ' },
          { status: 400 },
        );
      }
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(passwordHash);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Không có thông tin cần cập nhật' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await pool.query(
      `UPDATE app_users SET ${updates.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, email, display_name, role, is_active`,
      params,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

// DELETE: Deactivate user — super_admin only
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request);
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID là bắt buộc' }, { status: 400 });
    }

    const userCheck = await pool.query('SELECT role FROM app_users WHERE id = $1', [id]);
    if (userCheck.rows.length > 0 && userCheck.rows[0].role === 'super_admin') {
      return NextResponse.json({ error: 'Không thể xóa tài khoản Super Admin' }, { status: 403 });
    }

    await pool.query(
      'UPDATE app_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id],
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
