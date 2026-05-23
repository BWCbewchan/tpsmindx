import pool from '@/lib/db';
import { checkTeacherExistsByEmail, isDatabaseUnavailableError } from '@/lib/db-helpers';
import { getJwtSecret } from '@/lib/jwt-secret';
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory';
import { setSessionCookieOnResponse } from '@/lib/session-cookie';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimitOr429(
      `app-auth-login:${clientIpFromRequest(request)}`,
      40,
      60_000,
    );
    if (rl) return rl;

    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 });
    }

    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email và password là bắt buộc' }, { status: 400 });
    }

    const normalizedInput = email.trim().toLowerCase();
    let userResult;

    if (normalizedInput.includes('@')) {
      userResult = await pool.query(
        `SELECT * FROM app_users
         WHERE (email = $1 OR LOWER(username) = $1)
         AND is_active = true
         LIMIT 1`,
        [normalizedInput]
      );
    } else {
      const suffixes = ['@mindx.edu.vn', '@mindx.net.vn', '@mindx.com.vn'];
      const possibleEmails = suffixes.map(s => `${normalizedInput}${s}`);

      userResult = await pool.query(
        `SELECT * FROM app_users
         WHERE (LOWER(username) = $1 OR email = ANY($2::text[]))
         AND is_active = true
         ORDER BY
           CASE
             WHEN LOWER(username) = $1 THEN 1
             WHEN email LIKE $3 THEN 2
             ELSE 3
           END
         LIMIT 1`,
        [normalizedInput, possibleEmails, `%@mindx.edu.vn`]
      );
    }

    if (userResult.rows.length === 0) {
      return NextResponse.json({ appUser: false });
    }

    const user = userResult.rows[0];

    if (user.auth_type === 'firebase') {
      return NextResponse.json({ appUser: false });
    }

    if (!user.password_hash) {
      return NextResponse.json({ error: 'Tài khoản không có mật khẩu hợp lệ.' }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không chính xác' }, { status: 401 });
    }

    let permissions: string[] = [];
    try {
      const permissionsResult = await pool.query(
        `SELECT DISTINCT route_path
         FROM (
           SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true
           UNION
           SELECT rp.route_path FROM user_roles ur JOIN role_permissions rp ON rp.role_code = ur.role_code WHERE ur.user_id = $1
         ) permissions`,
        [user.id]
      );
      permissions = permissionsResult.rows.map((row: { route_path: string }) => row.route_path);
    } catch (permErr) {
      console.error('App auth: permissions query failed', permErr);
    }

    const hasAdminPerms = permissions.some(p => p.startsWith('/admin'));
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(user.role) || hasAdminPerms;

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        purpose: 'tps_edge',
        ap: isAdmin,
      },
      getJwtSecret(),
      { expiresIn: '24h' },
    );

    let teacherFoundInDb = false;
    if (user.role === 'teacher' && user.email) {
      try {
        teacherFoundInDb = await checkTeacherExistsByEmail(String(user.email).trim().toLowerCase());
      } catch (teacherErr) {
        console.warn('App auth teacher lookup failed:', teacherErr);
      }
    }

    const res = NextResponse.json({
      appUser: true,
      idToken: token,
      /** JWT nội bộ HS256 — alias của idToken (cùng giá trị), dùng làm Bearer cho /api/check-admin */
      accessToken: token,
      email: user.email,
      localId: `app_${user.id}`,
      displayName: user.display_name,
      role: user.role,
      isAdmin,
      permissions,
      teacherSync: { foundInDatabase: teacherFoundInDb },
    });
    setSessionCookieOnResponse(res, token);
    return res;
  } catch (error: unknown) {
    console.error('App auth login error:', error);
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({ appUser: false, dbUnavailable: true });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi server. Vui lòng thử lại sau.' }, { status: 500 });
  }
}
