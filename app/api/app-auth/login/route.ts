/**
 * ═══════════════════════════════════════════════════════════════════════
 * app/api/app-auth/login/route.ts — Đăng nhập bằng tài khoản nội bộ (admin/manager)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## LUỒNG XÁC THỰC
 *   1. Kiểm tra IP bị block (brute force guard)
 *   2. Rate limiting: 40 req/phút mỗi IP
 *   3. Tra cứu user trong bảng `app_users` theo email hoặc username
 *   4. Kiểm tra auth_type: nếu là 'firebase' thì fallback sang Firebase login
 *   5. So sánh password với bcrypt hash
 *   6. Ký JWT (HS256, 30 ngày) và set httpOnly cookie
 *   7. Ghi audit log (login_success / login_failed)
 *
 * ## BẢO MẬT
 *   - SELECT chỉ các cột cần thiết (không SELECT *) — tránh làm rò rỉ
 *     password_hash vào các biến không cần thiết
 *   - `checkAndRecordThreat`: tăng điểm threat score sau mỗi lần thất bại
 *   - `logLoginSuccess/Failed`: ghi audit log với IP, user-agent
 *   - JWT không chứa password_hash hay thông tin nhạy cảm
 *   - Cookie: httpOnly=true, secure=true (production), sameSite='lax'
 */
import pool from '@/lib/db';
import { checkTeacherExistsByEmailDetailed, isDatabaseUnavailableError } from '@/lib/db-helpers';
import { getJwtSecret } from '@/lib/jwt-secret';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { setSessionCookieOnResponse } from '@/lib/session-cookie';
import { logLoginFailed, logLoginSuccess } from '@/lib/audit-logger';
import { filterManagementPermissions } from '@/lib/admin-permission-routes';
import { checkAndRecordThreat, isIpBlocked } from '@/lib/brute-force-guard';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const ip        = clientIpFromRequest(request) ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? '';
  const endpoint  = 'POST /api/app-auth/login';

  try {
    // ── Kiểm tra IP có đang bị block do brute force không ──
    const blockStatus = await isIpBlocked(ip);
    if (blockStatus.blocked) {
      return NextResponse.json(
        { error: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.' },
        { status: 429 },
      );
    }

    const rl = await rateLimitOr429Async(
      `app-auth-login:${ip}`,
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
        // Chỉ chọn các cột cần thiết, không SELECT * — hạn chế rò rỉ password_hash
        `SELECT id, email, username, display_name, role, auth_type, is_active, password_hash
         FROM app_users
         WHERE (email = $1 OR LOWER(username) = $1)
         AND is_active = true
         LIMIT 1`,
        [normalizedInput]
      );
    } else {
      const suffixes = ['@mindx.edu.vn', '@mindx.net.vn', '@mindx.com.vn'];
      const possibleEmails = suffixes.map(s => `${normalizedInput}${s}`);

      userResult = await pool.query(
        // Chỉ chọn các cột cần thiết, không SELECT * — hạn chế rò rỉ password_hash
        `SELECT id, email, username, display_name, role, auth_type, is_active, password_hash
         FROM app_users
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
      console.warn(`⚠️ [APP-AUTH LOGIN] Không tìm thấy tài khoản app_users với email/username: "${normalizedInput}" -> Chuyển sang fallback Firebase`);
      // Not a final failed login yet: the UI can still fall back to Firebase auth.
      return NextResponse.json({ appUser: false });
    }

    const user = userResult.rows[0];

    const authType = String(user.auth_type ?? '').trim().toLowerCase();
    if (authType === 'firebase' || !user.password_hash) {
      console.warn(`⚠️ [APP-AUTH LOGIN] Tài khoản "${normalizedInput}" dùng auth_type='${user.auth_type}' hoặc chưa thiết lập password_hash -> Chuyển sang fallback Firebase`);
      return NextResponse.json({ appUser: false });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.error(`❌ [APP-AUTH LOGIN FAILED] Mật khẩu không chính xác cho tài khoản: "${normalizedInput}" (IP: ${ip})`);
      // Ghi log thất bại + kiểm tra brute force
      logLoginFailed({ email: normalizedInput, ip, userAgent, reason: 'wrong_password' });
      const threat = await checkAndRecordThreat(ip, 'LOGIN_FAIL');
      if (threat.blocked) {
        console.error(`❌ [APP-AUTH LOGIN FAILED] IP ${ip} bị khóa 30 phút do thử quá nhiều lần.`);
        return NextResponse.json(
          { error: `Quá nhiều lần thử. IP bị block 30 phút.` },
          { status: 429 },
        );
      }
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
      permissions = filterManagementPermissions(
        permissionsResult.rows.map((row: { route_path: string }) => row.route_path),
      );
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
      { expiresIn: '30d' }, // 30 ngày để giữ phiên đăng nhập lâu dài
    );


    let teacherSync:
      | { exists: boolean; dbUnavailable: boolean }
      | undefined;
    if (user.role === 'teacher' && user.email) {
      try {
        teacherSync = await checkTeacherExistsByEmailDetailed(
          String(user.email).trim().toLowerCase(),
        );
      } catch (teacherErr) {
        console.warn('App auth teacher lookup failed:', teacherErr);
      }
    }

    const res = NextResponse.json({
      appUser: true,
      email: user.email,
      localId: `app_${user.id}`,
      displayName: user.display_name,
      role: user.role,
      isAdmin,
      permissions,
      teacherSync: teacherSync
        ? {
            foundInDatabase: teacherSync.exists,
            dbUnavailable: teacherSync.dbUnavailable,
          }
        : undefined,
    });
    setSessionCookieOnResponse(res, token);

    // ── Ghi audit log đăng nhập thành công ──
    logLoginSuccess({
      email:     user.email,
      role:      user.role,
      ip,
      userAgent,
    });

    return res;
  } catch (error: unknown) {
    console.error('App auth login error:', error);
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({ appUser: false, dbUnavailable: true });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi server. Vui lòng thử lại sau.' }, { status: 500 });
  }
}
