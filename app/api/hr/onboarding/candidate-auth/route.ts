import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt-secret';
import { setSessionCookieOnResponse } from '@/lib/session-cookie';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập tài khoản và mật khẩu' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT u.id, u.candidate_id, u.password_hash, c.full_name, c.candidate_code,
              COALESCE(c.current_gen_id, c.gen_id) AS current_gen_id,
              g.gen_name AS current_gen_name,
              c.region_code, c.region_name
       FROM hr_candidate_users u
       JOIN hr_candidates c ON u.candidate_id = c.id
       LEFT JOIN hr_gen_catalog g ON g.id = COALESCE(c.current_gen_id, c.gen_id)
       WHERE u.username = $1 AND u.is_active = true AND c.is_deleted = false`,
      [username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản không tồn tại hoặc đã bị khóa' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // Update last login
    await pool.query('UPDATE hr_candidate_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Fetch permissions of role CANDI
    let permissions: string[] = [];
    try {
      const permResult = await pool.query(
        "SELECT DISTINCT route_path FROM role_permissions WHERE role_code = 'CANDI'"
      );
      permissions = permResult.rows.map((row: any) => row.route_path);
    } catch (permErr) {
      console.error('[Candidate Auth] failed to fetch CANDI permissions:', permErr);
    }

    const sessionEmail = `candidate-${user.candidate_id}@candidate.local`;
    const token = jwt.sign(
      {
        candidateId: user.candidate_id,
        email: sessionEmail,
        role: 'candidate',
        purpose: 'tps_edge',
        ap: false,
      },
      getJwtSecret(),
      { expiresIn: '12h' },
    );

    const res = NextResponse.json({
      success: true,
      data: {
        candidate_id: user.candidate_id,
        candidate_code: user.candidate_code,
        full_name: user.full_name,
        current_gen_id: user.current_gen_id,
        current_gen_name: user.current_gen_name,
        region_code: user.region_code,
        region_name: user.region_name,
        role: 'CANDI',
        permissions,
      }
    });
    setSessionCookieOnResponse(res, token);
    return res;

  } catch (error) {
    console.error('[Candidate Auth Error]', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống khi đăng nhập' },
      { status: 500 }
    );
  }
}
