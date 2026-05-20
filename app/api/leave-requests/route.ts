import { requireBearerDbRoles } from '@/lib/auth-server';
import { normalizeText as normalizeCampusText } from '@/lib/campus-data';
import { getAccessibleCenters } from '@/lib/center-access';
import {
    rejectIfEmailNotSelf,
    requireBearerSession,
} from '@/lib/datasource-api-auth';
import {
  SUBSTITUTE_DECLINE_AUDIT_PREFIX,
  stripSubstituteDeclineAuditFromAdminNote,
  withAdminNoteRedactedForTeacherView,
} from '@/lib/leave-request-admin-note-sanitize';
import { getPublicBaseUrl } from '@/lib/public-base-url';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type LeaveStatus =
  | 'pending_admin'
  | 'approved_unassigned'
  | 'approved_assigned'
  | 'rejected'
  | 'substitute_confirmed';

const VALID_STATUS: LeaveStatus[] = [
  'pending_admin',
  'approved_unassigned',
  'approved_assigned',
  'rejected',
  'substitute_confirmed'
];

const MIN_ADVANCE_HOURS_TEACHER = 72;

type AccessibleCenter = {
  id: number;
  full_name: string;
  short_code: string | null;
  region: string | null;
};

function normalizeCampusKey(value: unknown): string {
  return normalizeCampusText(String(value ?? ''));
}

function buildAccessibleCampusKeys(centers: AccessibleCenter[]): string[] {
  const keys = new Set<string>();

  for (const center of centers) {
    const candidates = [
      center.full_name,
      center.short_code ?? '',
    ];

    for (const candidate of candidates) {
      const key = normalizeCampusKey(candidate);
      if (key) keys.add(key);
    }
  }

  return Array.from(keys);
}

function campusIsAccessible(
  campus: string | null | undefined,
  allowedCampusKeys: string[],
): boolean {
  if (allowedCampusKeys.length === 0) return false;
  const campusKey = normalizeCampusKey(campus);
  if (!campusKey) return false;
  return allowedCampusKeys.includes(campusKey);
}

async function getAllowedCampusKeysForSession(
  sessionEmail: string,
  privileged: boolean,
): Promise<string[]> {
  if (privileged) return [];
  const centers = await getAccessibleCenters(sessionEmail);
  return buildAccessibleCampusKeys(centers as AccessibleCenter[]);
}

async function rejectIfLeaveRequestNotAccessible(
  sessionEmail: string,
  privileged: boolean,
  id: string | number,
): Promise<NextResponse | null> {
  if (privileged) return null;

  const targetId = Number(id);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Yêu cầu không hợp lệ' },
      { status: 400 },
    );
  }

  const requestResult = await pool.query(
    'SELECT campus FROM leave_requests WHERE id = $1 LIMIT 1',
    [targetId],
  );

  if (requestResult.rowCount === 0) {
    return NextResponse.json(
      { success: false, error: 'Không tìm thấy yêu cầu' },
      { status: 404 },
    );
  }

  const allowedCampusKeys = await getAllowedCampusKeysForSession(
    sessionEmail,
    privileged,
  );

  if (!campusIsAccessible(requestResult.rows[0]?.campus, allowedCampusKeys)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Không có quyền xử lý yêu cầu thuộc cơ sở này',
      },
      { status: 403 },
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  let client;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode');

    if (mode === 'admin') {
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;

      const allowedCampusKeys = await getAllowedCampusKeysForSession(
        gate.sessionEmail,
        gate.role === 'super_admin',
      );
      if (gate.role !== 'super_admin' && allowedCampusKeys.length === 0) {
        console.log('[leave-requests admin] no allowed campuses', {
          sessionEmail: gate.sessionEmail,
          role: gate.role,
        })

        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
        });
      }

      client = await pool.connect();

      let query = 'SELECT * FROM leave_requests';
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const status = searchParams.get('status');
      if (status && VALID_STATUS.includes(status as LeaveStatus)) {
        conditions.push(`status = $${idx}`);
        values.push(status);
        idx += 1;
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY created_at DESC';

      const result = await client.query(query, values);
      const visibleRows =
        gate.role === 'super_admin'
          ? result.rows
          : result.rows.filter((row) =>
              campusIsAccessible(row?.campus, allowedCampusKeys),
            )

      console.log('[leave-requests admin] resolved rows', {
        sessionEmail: gate.sessionEmail,
        role: gate.role,
        allowedCampusKeys,
        dbRowCount: result.rowCount,
        visibleRowCount: visibleRows.length,
      })

      return NextResponse.json({
        success: true,
        data: visibleRows,
        count: visibleRows.length,
      });
    }

    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = searchParams.get('email');
    const status = searchParams.get('status');

    if (mode === 'substitute' && email) {
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        email,
      );
      if (denied) return denied;
    } else if (email) {
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        email,
      );
      if (denied) return denied;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Cần email hoặc mode=admin với quyền quản trị',
        },
        { status: 400 },
      );
    }

    client = await pool.connect();

    let query = 'SELECT * FROM leave_requests';
    const conditions: string[] = [];
    const values: Array<string> = [];
    let idx = 1;

    if (mode === 'substitute' && email) {
      conditions.push(`LOWER(substitute_email) = LOWER($${idx})`);
      values.push(email);
      idx += 1;
    } else if (email) {
      conditions.push(`LOWER(email) = LOWER($${idx})`);
      values.push(email);
      idx += 1;
    }

    if (status && VALID_STATUS.includes(status as LeaveStatus)) {
      conditions.push(`status = $${idx}`);
      values.push(status);
      idx += 1;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await client.query(query, values);

    const data = auth.privileged
      ? result.rows
      : result.rows.map((r) => withAdminNoteRedactedForTeacherView(r));

    return NextResponse.json({
      success: true,
      data,
      count: result.rowCount
    });
  } catch (error: any) {
    console.error('leave-requests GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Có lỗi xảy ra khi lấy dữ liệu'
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: NextRequest) {
  let client;

  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const {
      teacher_name,
      lms_code,
      email,
      campus,
      leave_date,
      reason,
      class_code,
      student_count,
      class_time,
      leave_session,
      has_substitute,
      substitute_teacher,
      substitute_email,
      class_status,
      email_subject,
      email_body
    } = body;

    if (!teacher_name || !lms_code || !email || !campus || !leave_date || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        },
        { status: 400 }
      );
    }

    const denied = rejectIfEmailNotSelf(
      auth.sessionEmail,
      auth.privileged,
      String(email),
    );
    if (denied) return denied;

    const trimmedClassCode = typeof class_code === 'string' ? class_code.trim() : '';
    if (!trimmedClassCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng nhập mã lớp để tạo yêu cầu (tối đa 2 yêu cầu cho mỗi mã lớp).'
        },
        { status: 400 }
      );
    }

    const trimmedClassTime =
      typeof class_time === 'string' ? class_time.trim() : '';
    const trimmedLeaveSession =
      typeof leave_session === 'string' ? leave_session.trim() : '';
    if (!trimmedClassTime || !trimmedLeaveSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ thời gian học và buổi học xin nghỉ.'
        },
        { status: 400 }
      );
    }

    const studentCountTrim =
      student_count === undefined || student_count === null
        ? ''
        : String(student_count).trim();
    if (!studentCountTrim) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng nhập số học viên (số nguyên lớn hơn 0).',
        },
        { status: 400 },
      );
    }
    const studentCountNum = Number(studentCountTrim);
    if (
      !Number.isFinite(studentCountNum) ||
      !Number.isInteger(studentCountNum) ||
      studentCountNum <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Số học viên phải là số nguyên lớn hơn 0.',
        },
        { status: 400 },
      );
    }
    const normalizedStudentCount = String(studentCountNum);

    const normalizedHasSubstitute = Boolean(has_substitute);

    const center_id_raw =
      (body as { center_id?: unknown; centerId?: unknown }).center_id ??
      (body as { centerId?: unknown }).centerId;
    const campus_bu_email_raw =
      (body as { campus_bu_email?: unknown; campus_email?: unknown })
        .campus_bu_email ?? (body as { campus_email?: unknown }).campus_email;

    let resolvedCenterId: number | null = null;
    if (
      center_id_raw !== undefined &&
      center_id_raw !== null &&
      center_id_raw !== ''
    ) {
      const cid = Number(center_id_raw);
      if (!Number.isFinite(cid) || cid <= 0) {
        return NextResponse.json(
          { success: false, error: 'center_id không hợp lệ.' },
          { status: 400 },
        );
      }
      resolvedCenterId = cid;
    }

    let campusBuEmailDb: string | null = null;
    if (
      typeof campus_bu_email_raw === 'string' &&
      campus_bu_email_raw.trim().length > 0
    ) {
      const em = campus_bu_email_raw.trim();
      if (em.length > 255) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email BU cơ sở không quá 255 ký tự.',
          },
          { status: 400 },
        );
      }
      if (!/\S+@\S+\.\S+/.test(em)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email BU cơ sở chưa đúng định dạng.',
          },
          { status: 400 },
        );
      }
      campusBuEmailDb = em;
    }

    client = await pool.connect();

    if (resolvedCenterId != null) {
      const ccheck = await client.query(
        `SELECT id FROM centers WHERE id = $1 AND status = 'Active' LIMIT 1`,
        [resolvedCenterId],
      );
      if (ccheck.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Cơ sở đã chọn không tồn tại hoặc không còn hoạt động (center_id).',
          },
          { status: 400 },
        );
      }
    }

    const countSameClass = await client.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM leave_requests
      WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
        AND LOWER(TRIM(class_code)) = LOWER(TRIM($2))
      `,
      [email, trimmedClassCode]
    );

    const existingForClass = countSameClass.rows[0]?.cnt ?? 0;
    if (existingForClass >= 2) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Mỗi mã lớp chỉ được tạo tối đa 2 yêu cầu xin nghỉ. Bạn đã đạt giới hạn cho mã lớp này.'
        },
        { status: 400 }
      );
    }

    const insertQuery = `
      INSERT INTO leave_requests (
        teacher_name,
        lms_code,
        email,
        campus,
        leave_date,
        reason,
        class_code,
        student_count,
        class_time,
        leave_session,
        has_substitute,
        substitute_teacher,
        substitute_email,
        class_status,
        email_subject,
        email_body,
        center_id,
        campus_bu_email,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, 'pending_admin'
      )
      RETURNING *
    `;

    const values = [
      teacher_name,
      lms_code,
      email,
      campus,
      leave_date,
      reason,
      trimmedClassCode,
      normalizedStudentCount,
      trimmedClassTime,
      trimmedLeaveSession,
      normalizedHasSubstitute,
      substitute_teacher || null,
      substitute_email || null,
      class_status || null,
      email_subject || null,
      email_body || null,
      resolvedCenterId,
      campusBuEmailDb,
    ];

    const result = await client.query(insertQuery, values);

    return NextResponse.json({
      success: true,
      message: 'Tạo yêu cầu xin nghỉ thành công',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('leave-requests POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Có lỗi xảy ra khi tạo yêu cầu'
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

export async function PATCH(request: NextRequest) {
  let client;

  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { action, id } = body;

    if (!id || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu thông tin bắt buộc'
        },
        { status: 400 }
      );
    }

    if (action === 'admin_review') {
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;

      const campusDenied = await rejectIfLeaveRequestNotAccessible(
        gate.sessionEmail,
        gate.role === 'super_admin',
        id,
      );
      if (campusDenied) return campusDenied;

      const sessionAdminEmail = gate.sessionEmail;
      const {
        decision,
        admin_note,
        admin_name,
        substitute_teacher,
        substitute_email
      } = body;

      if (!['approved', 'rejected'].includes(decision)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Quyết định duyệt không hợp lệ'
          },
          { status: 400 }
        );
      }

      client = await pool.connect();

      if (decision === 'rejected') {
        const rejectedQuery = `
          UPDATE leave_requests
          SET
            status = 'rejected',
            admin_note = $1,
            admin_email = $2,
            admin_name = $3
          WHERE id = $4
          RETURNING *
        `;

        const rejectedResult = await client.query(rejectedQuery, [
          admin_note || null,
          sessionAdminEmail,
          admin_name || null,
          id,
        ]);

        if (rejectedResult.rowCount === 0) {
          return NextResponse.json({ success: false, error: 'Không tìm thấy yêu cầu' }, { status: 404 });
        }

        const rejectedRow = rejectedResult.rows[0] as Record<string, unknown>;

        try {
          await fetch(
            `${getPublicBaseUrl()}/api/emails`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'leave_admin_rejected',
                data: {
                  request_id: String(rejectedRow.id ?? id),
                  teacher_name: String(rejectedRow.teacher_name ?? ''),
                  teacher_email: String(rejectedRow.email ?? '').trim() || undefined,
                  campus:
                    rejectedRow.campus != null
                      ? String(rejectedRow.campus)
                      : undefined,
                  class_code:
                    rejectedRow.class_code != null
                      ? String(rejectedRow.class_code)
                      : undefined,
                  leave_date:
                    rejectedRow.leave_date != null
                      ? String(rejectedRow.leave_date)
                      : undefined,
                  class_time:
                    rejectedRow.class_time != null
                      ? String(rejectedRow.class_time)
                      : undefined,
                  leave_session:
                    rejectedRow.leave_session != null
                      ? String(rejectedRow.leave_session)
                      : undefined,
                  reason:
                    rejectedRow.reason != null
                      ? String(rejectedRow.reason)
                      : undefined,
                  admin_note:
                    rejectedRow.admin_note != null
                      ? String(rejectedRow.admin_note)
                      : undefined,
                  admin_name:
                    rejectedRow.admin_name != null
                      ? String(rejectedRow.admin_name)
                      : undefined,
                  admin_email:
                    rejectedRow.admin_email != null
                      ? String(rejectedRow.admin_email)
                      : undefined,
                  campus_bu_email:
                    rejectedRow.campus_bu_email != null
                      ? String(rejectedRow.campus_bu_email).trim() || undefined
                      : undefined,
                },
              }),
            },
          );
        } catch (mailError) {
          console.error('leave-requests admin_review reject email error:', mailError);
        }

        return NextResponse.json({ success: true, data: rejectedRow });
      }

      const hasAssignedSubstitute = Boolean(substitute_teacher || substitute_email);
      const approvedStatus: LeaveStatus = hasAssignedSubstitute ? 'approved_assigned' : 'approved_unassigned';

      const approvedQuery = `
        UPDATE leave_requests
        SET
          status = $1,
          admin_note = $2,
          admin_email = $3,
          admin_name = $4,
          substitute_teacher = COALESCE($5, substitute_teacher),
          substitute_email = COALESCE($6, substitute_email)
        WHERE id = $7
        RETURNING *
      `;

      const approvedResult = await client.query(approvedQuery, [
        approvedStatus,
        admin_note || null,
        sessionAdminEmail,
        admin_name || null,
        substitute_teacher || null,
        substitute_email || null,
        id
      ]);

      if (approvedResult.rowCount === 0) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy yêu cầu' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: approvedResult.rows[0] });
    }

    if (action === 'teacher_update') {
      const idNum = Number(id);
      if (!Number.isFinite(idNum) || idNum <= 0) {
        return NextResponse.json(
          { success: false, error: 'Mã yêu cầu không hợp lệ' },
          { status: 400 },
        );
      }

      const {
        teacher_name,
        lms_code,
        email: bodyEmail,
        campus,
        leave_date,
        reason,
        class_code,
        student_count,
        class_time,
        leave_session,
        has_substitute,
        substitute_teacher,
        substitute_email,
        class_status,
        email_subject,
        email_body,
      } = body;

      client = await pool.connect();

      const sel = await client.query(
        'SELECT * FROM leave_requests WHERE id = $1 LIMIT 1',
        [idNum],
      );
      if (sel.rowCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy yêu cầu' },
          { status: 404 },
        );
      }

      const existingRow = sel.rows[0] as Record<string, unknown>;
      if (String(existingRow.status ?? '') !== 'pending_admin') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Chỉ chỉnh sửa được khi yêu cầu đang chờ TC/Leader duyệt.',
          },
          { status: 400 },
        );
      }

      const deniedTeacher = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        String(existingRow.email ?? ''),
      );
      if (deniedTeacher) return deniedTeacher;

      if (
        bodyEmail != null &&
        String(bodyEmail).trim().toLowerCase() !==
          String(existingRow.email ?? '')
            .trim()
            .toLowerCase()
      ) {
        return NextResponse.json(
          { success: false, error: 'Không được đổi email của yêu cầu.' },
          { status: 400 },
        );
      }

      if (
        !teacher_name ||
        !lms_code ||
        !campus ||
        !leave_date ||
        !reason
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng điền đầy đủ thông tin bắt buộc',
          },
          { status: 400 },
        );
      }

      const trimmedClassCode =
        typeof class_code === 'string' ? class_code.trim() : '';
      if (!trimmedClassCode) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Vui lòng nhập mã lớp (tối đa 2 yêu cầu cho mỗi mã lớp).',
          },
          { status: 400 },
        );
      }

      const trimmedClassTime =
        typeof class_time === 'string' ? class_time.trim() : '';
      const trimmedLeaveSession =
        typeof leave_session === 'string' ? leave_session.trim() : '';
      if (!trimmedClassTime || !trimmedLeaveSession) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng điền đầy đủ thời gian học và buổi học xin nghỉ.',
          },
          { status: 400 },
        );
      }

      const studentCountTrim =
        student_count === undefined || student_count === null
          ? ''
          : String(student_count).trim();
      if (!studentCountTrim) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng nhập số học viên (số nguyên lớn hơn 0).',
          },
          { status: 400 },
        );
      }
      const studentCountNum = Number(studentCountTrim);
      if (
        !Number.isFinite(studentCountNum) ||
        !Number.isInteger(studentCountNum) ||
        studentCountNum <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Số học viên phải là số nguyên lớn hơn 0.',
          },
          { status: 400 },
        );
      }
      const normalizedStudentCount = String(studentCountNum);

      if (String(reason).trim().length < 10) {
        return NextResponse.json(
          {
            success: false,
            error: 'Lý do xin nghỉ cần rõ ràng hơn (tối thiểu 10 ký tự).',
          },
          { status: 400 },
        );
      }

      const ldRaw = String(leave_date);
      const ld =
        ldRaw.includes('T') ? ldRaw.split('T')[0]! : ldRaw.slice(0, 10);
      const leaveDateMs = new Date(`${ld}T00:00:00`).getTime();
      const diffHours = (leaveDateMs - Date.now()) / (1000 * 60 * 60);
      if (diffHours < MIN_ADVANCE_HOURS_TEACHER) {
        return NextResponse.json(
          {
            success: false,
            error: `Ngày xin nghỉ cần cách thời điểm hiện tại tối thiểu ${MIN_ADVANCE_HOURS_TEACHER} giờ.`,
          },
          { status: 400 },
        );
      }

      const normalizedHasSubstitute = Boolean(has_substitute);
      if (normalizedHasSubstitute) {
        const st = String(substitute_teacher ?? '').trim();
        const se = String(substitute_email ?? '').trim();
        if (!st || !se) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Nếu có giáo viên thay thế, cần nhập đầy đủ tên và email.',
            },
            { status: 400 },
          );
        }
        if (!/\S+@\S+\.\S+/.test(se)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Email giáo viên thay thế chưa đúng định dạng.',
            },
            { status: 400 },
          );
        }
      }

      const center_id_raw =
        (body as { center_id?: unknown; centerId?: unknown }).center_id ??
        (body as { centerId?: unknown }).centerId;
      const campus_bu_email_raw =
        (body as { campus_bu_email?: unknown; campus_email?: unknown })
          .campus_bu_email ?? (body as { campus_email?: unknown }).campus_email;

      let resolvedCenterId: number | null = null;
      if (
        center_id_raw !== undefined &&
        center_id_raw !== null &&
        center_id_raw !== ''
      ) {
        const cid = Number(center_id_raw);
        if (!Number.isFinite(cid) || cid <= 0) {
          return NextResponse.json(
            { success: false, error: 'center_id không hợp lệ.' },
            { status: 400 },
          );
        }
        resolvedCenterId = cid;
      }

      let campusBuEmailDb: string | null = null;
      if (
        typeof campus_bu_email_raw === 'string' &&
        campus_bu_email_raw.trim().length > 0
      ) {
        const em = campus_bu_email_raw.trim();
        if (em.length > 255) {
          return NextResponse.json(
            {
              success: false,
              error: 'Email BU cơ sở không quá 255 ký tự.',
            },
            { status: 400 },
          );
        }
        if (!/\S+@\S+\.\S+/.test(em)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Email BU cơ sở chưa đúng định dạng.',
            },
            { status: 400 },
          );
        }
        campusBuEmailDb = em;
      }

      if (resolvedCenterId != null) {
        const ccheck = await client.query(
          `SELECT id FROM centers WHERE id = $1 AND status = 'Active' LIMIT 1`,
          [resolvedCenterId],
        );
        if (ccheck.rowCount === 0) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Cơ sở đã chọn không tồn tại hoặc không còn hoạt động (center_id).',
            },
            { status: 400 },
          );
        }
      }

      const rowEmail = String(existingRow.email ?? '').trim();
      const dup = await client.query(
        `
        SELECT COUNT(*)::int AS cnt
        FROM leave_requests
        WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
          AND LOWER(TRIM(class_code)) = LOWER(TRIM($2))
          AND id <> $3
        `,
        [rowEmail, trimmedClassCode, idNum],
      );
      const dupCnt = dup.rows[0]?.cnt ?? 0;
      if (dupCnt >= 2) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Mỗi mã lớp chỉ được tối đa 2 yêu cầu xin nghỉ. Bạn đã đạt giới hạn cho mã lớp này.',
          },
          { status: 400 },
        );
      }

      const subT = normalizedHasSubstitute
        ? String(substitute_teacher ?? '').trim() || null
        : null;
      const subE = normalizedHasSubstitute
        ? String(substitute_email ?? '').trim() || null
        : null;

      const updateQuery = `
        UPDATE leave_requests
        SET
          teacher_name = $1,
          lms_code = $2,
          campus = $3,
          leave_date = $4,
          reason = $5,
          class_code = $6,
          student_count = $7,
          class_time = $8,
          leave_session = $9,
          has_substitute = $10,
          substitute_teacher = $11,
          substitute_email = $12,
          class_status = $13,
          email_subject = $14,
          email_body = $15,
          center_id = $16,
          campus_bu_email = $17
        WHERE id = $18
          AND status = 'pending_admin'
        RETURNING *
      `;

      const upd = await client.query(updateQuery, [
        teacher_name,
        lms_code,
        campus,
        leave_date,
        reason,
        trimmedClassCode,
        normalizedStudentCount,
        trimmedClassTime,
        trimmedLeaveSession,
        normalizedHasSubstitute,
        subT,
        subE,
        typeof class_status === 'string' && class_status.trim()
          ? class_status.trim()
          : null,
        email_subject || null,
        email_body || null,
        resolvedCenterId,
        campusBuEmailDb,
        idNum,
      ]);

      if (upd.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Không cập nhật được (trạng thái đã thay đổi?).',
          },
          { status: 400 },
        );
      }

      const updatedRow = upd.rows[0] as Record<string, unknown>;
      const outRow = auth.privileged
        ? updatedRow
        : withAdminNoteRedactedForTeacherView(updatedRow);
      return NextResponse.json({ success: true, data: outRow });
    }

    if (action === 'assign_substitute') {
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;
      const campusDenied = await rejectIfLeaveRequestNotAccessible(
        gate.sessionEmail,
        gate.role === 'super_admin',
        id,
      );
      if (campusDenied) return campusDenied;

      const sessionAdminEmail = gate.sessionEmail;

      const { substitute_teacher, substitute_email, admin_name } = body;

      if (!substitute_teacher && !substitute_email) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng nhập giáo viên thay thế'
          },
          { status: 400 }
        );
      }

      client = await pool.connect();

      const assignQuery = `
        UPDATE leave_requests
        SET
          status = 'approved_assigned',
          substitute_teacher = $1,
          substitute_email = $2,
          admin_email = COALESCE($3, admin_email),
          admin_name = COALESCE($4, admin_name)
        WHERE id = $5
          AND status IN ('approved_unassigned', 'approved_assigned')
        RETURNING *
      `;

      const assignResult = await client.query(assignQuery, [
        substitute_teacher || null,
        substitute_email || null,
        sessionAdminEmail,
        admin_name || null,
        id
      ]);

      if (assignResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Không tìm thấy yêu cầu hoặc trạng thái không cho phép gán/sửa GV thay (chỉ khi đã duyệt và chưa hoàn tất).',
          },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true, data: assignResult.rows[0] });
    }

    if (action === 'admin_save_fields') {
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;

      const campusDenied = await rejectIfLeaveRequestNotAccessible(
        gate.sessionEmail,
        gate.role === 'super_admin',
        id,
      );
      if (campusDenied) return campusDenied;

      const { admin_note, substitute_teacher, substitute_email } = body;

      const t = String(substitute_teacher ?? '').trim();
      const e = String(substitute_email ?? '').trim();
      if ((t || e) && (!t || !e)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng nhập đủ tên và email giáo viên thay thế.',
          },
          { status: 400 },
        );
      }
      if (e && !/\S+@\S+\.\S+/.test(e)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email giáo viên thay thế chưa đúng định dạng.',
          },
          { status: 400 },
        );
      }

      client = await pool.connect();

      const saveQuery = `
        UPDATE leave_requests
        SET
          admin_note = $1,
          substitute_teacher = $2,
          substitute_email = $3,
          status = CASE
            WHEN status = 'approved_unassigned'
              AND NULLIF(TRIM($5), '') IS NOT NULL
              AND NULLIF(TRIM($6), '') IS NOT NULL
            THEN 'approved_assigned'
            ELSE status
          END
        WHERE id = $4
          AND status IN (
            'pending_admin',
            'approved_unassigned',
            'approved_assigned'
          )
        RETURNING *
      `;

      const saveResult = await client.query(saveQuery, [
        typeof admin_note === 'string' && admin_note.trim()
          ? admin_note.trim()
          : null,
        t || null,
        e || null,
        id,
        t || null,
        e || null,
      ]);

      if (saveResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Không lưu được: chỉ khi yêu cầu ở trạng thái chờ duyệt, đã duyệt chưa có GV thay, hoặc đã gửi GV thay.',
          },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true, data: saveResult.rows[0] });
    }

    if (action === 'substitute_confirm') {
      const { substitute_email } = body;
      const sub = String(substitute_email || '').trim().toLowerCase();
      const denied = rejectIfEmailNotSelf(auth.sessionEmail, false, sub);
      if (denied) return denied;

      client = await pool.connect();

      const confirmQuery = `
        UPDATE leave_requests
        SET
          status = 'substitute_confirmed',
          substitute_confirmed_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND status = 'approved_assigned'
          AND LOWER(substitute_email) = LOWER($2)
        RETURNING *
      `;

      const confirmResult = await client.query(confirmQuery, [id, substitute_email || '']);

      if (confirmResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Không tìm thấy yêu cầu phù hợp để xác nhận'
          },
          { status: 404 }
        );
      }

      const confirmedRow = confirmResult.rows[0];

      try {
        await fetch(`${getPublicBaseUrl()}/api/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'leave_approved_substitute_confirmed',
            data: {
              teacher_name: confirmedRow.teacher_name,
              teacher_email: confirmedRow.email,
              campus: confirmedRow.campus,
              class_code: confirmedRow.class_code,
              leave_date: confirmedRow.leave_date,
              class_time: confirmedRow.class_time,
              leave_session: confirmedRow.leave_session,
              substitute_teacher: confirmedRow.substitute_teacher,
              substitute_email: confirmedRow.substitute_email,
              reason: confirmedRow.reason,
              admin_note: confirmedRow.admin_note,
              admin_name: confirmedRow.admin_name,
              admin_email: confirmedRow.admin_email,
              substitute_confirmed_at: confirmedRow.substitute_confirmed_at,
              campus_bu_email:
                confirmedRow.campus_bu_email != null
                  ? String(confirmedRow.campus_bu_email).trim() || undefined
                  : undefined,
            },
          }),
        });
      } catch (mailError) {
        console.error('leave-requests substitute_confirm email error:', mailError);
      }

      const outRow = auth.privileged
        ? confirmedRow
        : withAdminNoteRedactedForTeacherView(
            confirmedRow as Record<string, unknown>,
          );
      return NextResponse.json({ success: true, data: outRow });
    }

    if (action === 'substitute_decline') {
      const { substitute_email, decline_reason } = body;
      const sub = String(substitute_email || '').trim().toLowerCase();
      const denied = rejectIfEmailNotSelf(auth.sessionEmail, false, sub);
      if (denied) return denied;

      const reason =
        typeof decline_reason === 'string' ? decline_reason.trim() : '';
      if (reason.length > 2000) {
        return NextResponse.json(
          {
            success: false,
            error: 'Lý do từ chối không quá 2000 ký tự.',
          },
          { status: 400 },
        );
      }

      const stamp =
        `${SUBSTITUTE_DECLINE_AUDIT_PREFIX} Thời điểm: ` +
        new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const suffix =
        reason.length > 0 ? `\nLý do: ${reason}` : '';

      client = await pool.connect();

      const declineQuery = `
        UPDATE leave_requests
        SET
          status = 'approved_unassigned',
          substitute_teacher = NULL,
          substitute_email = NULL,
          substitute_confirmed_at = NULL,
          admin_note = TRIM(
            CASE
              WHEN COALESCE(admin_note, '') = '' THEN $1::text
              ELSE COALESCE(admin_note, '') || E'\\n\\n---\\n' || $1::text
            END
          )
        WHERE id = $2
          AND status = 'approved_assigned'
          AND LOWER(TRIM(substitute_email)) = LOWER(TRIM($3::text))
        RETURNING *
      `;

      const declineNote = `${stamp}${suffix}`;

      const declineResult = await client.query(declineQuery, [
        declineNote,
        id,
        substitute_email || '',
      ]);

      if (declineResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Không tìm thấy yêu cầu phù hợp để từ chối (chỉ khi đang chờ GV thay xác nhận và đúng email được phân).',
          },
          { status: 404 },
        );
      }

      const declined = declineResult.rows[0] as Record<string, unknown>;
      const outDeclined = auth.privileged
        ? declined
        : {
            ...declined,
            admin_note: stripSubstituteDeclineAuditFromAdminNote(
              declined.admin_note as string | null | undefined,
            ),
          };
      return NextResponse.json({ success: true, data: outDeclined });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Action không hợp lệ'
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('leave-requests PATCH error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Có lỗi xảy ra khi cập nhật yêu cầu'
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
