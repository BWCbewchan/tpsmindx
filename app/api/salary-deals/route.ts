import {
  rejectIfEmailNotSelf,
  requireBearerSession,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: Lấy danh sách salary deals
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const dealType = searchParams.get('deal_type');

    if (email) {
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        email,
      );
      if (denied) return denied;
    } else if (!auth.privileged) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cần tham số email hoặc quyền tra cứu toàn hệ thống',
        },
        { status: 403 },
      );
    }

    client = await pool.connect();

    let query = 'SELECT * FROM salary_deals';
    const conditions: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (email) {
      conditions.push(`submitter_email = $${p++}`);
      values.push(email);
    }
    if (status) {
      conditions.push(`status = $${p++}`);
      values.push(status);
    }
    if (dealType) {
      conditions.push(`deal_type = $${p++}`);
      values.push(dealType);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const result = await client.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: unknown) {
    console.error('Salary deals GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ' },
      { status: 500 },
    );
  } finally {
    client?.release();
  }
}

// POST: Tạo yêu cầu mới
export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      deal_type,
      submitter_email,
      submitter_name,
      teacher_name,
      teacher_codename,
      teacher_email,
      class_code,
      bonus_amount,
      bonus_reason,
      deal_salary_amount,
      teacher_experience,
      teacher_certificates,
      current_rate,
      new_rate,
    } = body;

    if (!deal_type || !submitter_email || !submitter_name || !teacher_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ thông tin bắt buộc',
        },
        { status: 400 },
      );
    }

    const denied = rejectIfEmailNotSelf(
      auth.sessionEmail,
      auth.privileged,
      String(submitter_email),
    );
    if (denied) return denied;

    if (!['bonus', 'salary_reduction', 'salary_deal'].includes(deal_type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Loại yêu cầu không hợp lệ',
        },
        { status: 400 },
      );
    }

    client = await pool.connect();

    const result = await client.query(
      `
      INSERT INTO salary_deals (
        deal_type, submitter_email, submitter_name,
        teacher_name, teacher_codename, teacher_email,
        class_code, bonus_amount, bonus_reason,
        deal_salary_amount, teacher_experience, teacher_certificates,
        current_rate, new_rate, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
      RETURNING *
    `,
      [
        deal_type,
        submitter_email,
        submitter_name,
        teacher_name,
        teacher_codename || null,
        teacher_email || null,
        class_code || null,
        bonus_amount || null,
        bonus_reason || null,
        deal_salary_amount || null,
        teacher_experience || null,
        teacher_certificates || null,
        current_rate || null,
        new_rate || null,
      ],
    );

    return NextResponse.json({
      success: true,
      message: 'Tạo yêu cầu thành công',
      data: result.rows[0],
    });
  } catch (error: unknown) {
    console.error('Salary deals POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ' },
      { status: 500 },
    );
  } finally {
    client?.release();
  }
}

// PATCH: Duyệt / Từ chối (TEGL hoặc Admin) — email người duyệt lấy từ Bearer, không tin body
export async function PATCH(request: NextRequest) {
  let client;
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, action, note, reviewer_name } = body;

    if (!id || !action || !reviewer_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu thông tin bắt buộc',
        },
        { status: 400 },
      );
    }

    const reviewer_email = auth.sessionEmail;

    client = await pool.connect();

    const current = await client.query('SELECT * FROM salary_deals WHERE id = $1', [
      id,
    ]);
    if (current.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy yêu cầu' },
        { status: 404 },
      );
    }

    const deal = current.rows[0];

    const reviewerResult = await client.query(
      'SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true',
      [reviewer_email.toLowerCase()],
    );
    const reviewerRole = reviewerResult.rows[0]?.role;

    if (deal.status === 'pending' && reviewerRole !== 'manager') {
      return NextResponse.json(
        {
          success: false,
          error: 'Chỉ TEGL (Manager) mới có thể duyệt bước này',
        },
        { status: 403 },
      );
    }

    if (deal.status === 'tegl_approved' && reviewerRole !== 'super_admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Chỉ Super Admin mới có thể phê duyệt cuối cùng',
        },
        { status: 403 },
      );
    }

    let newStatus: string;
    let updateFields: string;
    let updateValues: unknown[];

    if (deal.status === 'pending') {
      newStatus = action === 'approve' ? 'tegl_approved' : 'tegl_rejected';
      updateFields = `
        status = $1, tegl_note = $2, tegl_email = $3, tegl_name = $4,
        tegl_decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      `;
      updateValues = [newStatus, note || null, reviewer_email, reviewer_name, id];
    } else if (deal.status === 'tegl_approved') {
      newStatus = action === 'approve' ? 'admin_approved' : 'admin_rejected';
      updateFields = `
        status = $1, admin_note = $2, admin_email = $3, admin_name = $4,
        admin_decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      `;
      updateValues = [newStatus, note || null, reviewer_email, reviewer_name, id];
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Yêu cầu này không thể duyệt ở trạng thái hiện tại',
        },
        { status: 400 },
      );
    }

    const result = await client.query(
      `UPDATE salary_deals SET ${updateFields} WHERE id = $5 RETURNING *`,
      updateValues,
    );

    const statusLabel = action === 'approve' ? 'duyệt' : 'từ chối';
    return NextResponse.json({
      success: true,
      message: `Đã ${statusLabel} yêu cầu thành công`,
      data: result.rows[0],
    });
  } catch (error: unknown) {
    console.error('Salary deals PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ' },
      { status: 500 },
    );
  } finally {
    client?.release();
  }
}
