import { checkHrefPermission } from '@/lib/menu-permissions';
import {
  rejectIfEmailNotSelf,
  requireBearerSession,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { createNotification } from '@/lib/notification-service';
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

    const canReadAll = checkHrefPermission('/admin/deal-luong', auth.resolvedAccess);
    if ((!email || email.trim().toLowerCase() !== auth.sessionEmail.trim().toLowerCase()) && !canReadAll) {
      return NextResponse.json({ success: false, error: 'Bạn chưa được cấp quyền xem các thỏa thuận lương.' }, { status: 403 });
    }

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

    if (auth.resolvedAccess.isAdmin && !checkHrefPermission('/admin/tao-deal-luong', auth.resolvedAccess)) {
      return NextResponse.json({ success: false, error: 'Bạn chưa được cấp quyền tạo thỏa thuận lương.' }, { status: 403 });
    }
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

    const newDeal = result.rows[0];

    // Gửi thông báo trong app cho người tạo
    await createNotification({
      recipientEmail: submitter_email,
      title: 'Đã gửi yêu cầu thỏa thuận lương',
      content: `Yêu cầu thỏa thuận lương cho giáo viên ${teacher_name} đã được gửi thành công. Trạng thái: Chờ duyệt.`,
      type: 'salary_deal',
      link: '/user/profile',
    }).catch(err => console.error('Notification error:', err));

    // Nếu giáo viên có email và khác người tạo, gửi thông báo cho giáo viên đó
    if (teacher_email && teacher_email.trim().toLowerCase() !== submitter_email.trim().toLowerCase()) {
      await createNotification({
        recipientEmail: teacher_email,
        title: 'Có đề xuất điều chỉnh lương mới',
        content: `Một đề xuất điều chỉnh lương đã được tạo cho bạn bởi ${submitter_name}.`,
        type: 'salary_deal',
        link: '/user/profile',
      }).catch(err => console.error('Notification error:', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Tạo yêu cầu thành công',
      data: newDeal,
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

    if (!checkHrefPermission('/admin/deal-luong', auth.resolvedAccess)) {
      return NextResponse.json({ success: false, error: 'Bạn chưa được cấp quyền duyệt thỏa thuận lương.' }, { status: 403 });
    }
    const body = await request.json();
    const { id, action, note, reviewer_name } = body;

    if (!id || !['approve', 'reject'].includes(action) || !reviewer_name) {
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

    const updatedDeal = result.rows[0];
    const statusLabel = action === 'approve' ? 'duyệt' : 'từ chối';

    // Xác định nội dung thông báo dựa trên trạng thái mới
    let notificationContent = '';
    if (newStatus === 'tegl_approved') {
      notificationContent = `Yêu cầu thỏa thuận lương cho ${updatedDeal.teacher_name} đã được TEGL duyệt. Đang chờ Super Admin phê duyệt cuối cùng.`;
    } else if (newStatus === 'tegl_rejected') {
      notificationContent = `Yêu cầu thỏa thuận lương cho ${updatedDeal.teacher_name} đã bị TEGL từ chối.`;
    } else if (newStatus === 'admin_approved') {
      notificationContent = `Yêu cầu thỏa thuận lương cho ${updatedDeal.teacher_name} đã được phê duyệt thành công.`;
    } else if (newStatus === 'admin_rejected') {
      notificationContent = `Yêu cầu thỏa thuận lương cho ${updatedDeal.teacher_name} đã bị từ chối phê duyệt.`;
    }

    // 1. Gửi thông báo cho người tạo yêu cầu (submitter)
    await createNotification({
      recipientEmail: updatedDeal.submitter_email,
      title: `Cập nhật yêu cầu thỏa thuận lương`,
      content: notificationContent,
      type: 'salary_deal',
      link: '/user/profile',
    }).catch(err => console.error('Notification error:', err));

    // 2. Gửi thông báo cho giáo viên được đề xuất (nếu có email và khác người tạo)
    if (updatedDeal.teacher_email && updatedDeal.teacher_email.trim().toLowerCase() !== updatedDeal.submitter_email.trim().toLowerCase()) {
      await createNotification({
        recipientEmail: updatedDeal.teacher_email,
        title: `Cập nhật đề xuất điều chỉnh lương`,
        content: notificationContent,
        type: 'salary_deal',
        link: '/user/profile',
      }).catch(err => console.error('Notification error:', err));
    }

    return NextResponse.json({
      success: true,
      message: `Đã ${statusLabel} yêu cầu thành công`,
      data: updatedDeal,
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
