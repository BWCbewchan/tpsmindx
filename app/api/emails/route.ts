import { NextResponse } from 'next/server';
import { renderTemplate } from './render';
import { sendMail } from './transporter';

type LeaveApprovedPayload = {
  teacher_name: string;
  teacher_email: string;
  campus?: string;
  /** Email CS/BU cơ sở lưu trên phiếu (bảng `centers` / snapshot khi GV gửi). */
  campus_bu_email?: string;
  class_code?: string;
  leave_date?: string;
  class_time?: string;
  leave_session?: string;
  substitute_teacher?: string;
  substitute_email?: string;
  reason?: string;
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
  substitute_confirmed_at?: string;
};

type LeaveAdminRejectedPayload = {
  request_id: string;
  teacher_name: string;
  teacher_email?: string;
  campus?: string;
  campus_bu_email?: string;
  class_code?: string;
  leave_date?: string;
  class_time?: string;
  leave_session?: string;
  reason?: string;
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
};

function formatDateTime(input?: string) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString('vi-VN');
}

function formatDate(input?: string) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('vi-VN');
}

function uniqueRecipientEmails(
  ...raw: Array<string | undefined | null>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = String(r ?? '').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** CC: mentor gửi — loại trùng với To (vd. GV thay trùng email GV xin nghỉ). */
function ccExcludingTo(
  ccCandidates: Array<string | undefined | null>,
  toList: string[],
): string[] {
  const toSet = new Set(toList.map((e) => e.trim().toLowerCase()).filter(Boolean));
  return uniqueRecipientEmails(...ccCandidates).filter(
    (e) => !toSet.has(e.toLowerCase()),
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body as {
      type?: string;
      data?:
        | LeaveApprovedPayload
        | LeaveAdminRejectedPayload;
    };

    if (type === 'leave_approved_substitute_confirmed') {
      const d = data as LeaveApprovedPayload;
      if (!d?.teacher_name || !d?.teacher_email || !d?.substitute_email) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields: teacher_name, teacher_email, substitute_email',
          },
          { status: 400 },
        );
      }

      const html = renderTemplate('leave-approved-substitute-confirmed', {
        teacher_name: d.teacher_name,
        teacher_email: d.teacher_email,
        campus: d.campus,
        class_code: d.class_code,
        leave_date: formatDate(d.leave_date),
        class_time: d.class_time,
        leave_session: d.leave_session,
        substitute_teacher: d.substitute_teacher,
        substitute_email: d.substitute_email,
        reason: d.reason,
        admin_note: d.admin_note,
        admin_name: d.admin_name,
        admin_email: d.admin_email,
        substitute_confirmed_at: formatDateTime(d.substitute_confirmed_at),
      });

      /** To: người duyệt (TC/Leader), GV thay (không gửi BU). CC: GV xin nghỉ, trừ trùng To. */
      const to = uniqueRecipientEmails(d.admin_email, d.substitute_email);
      if (to.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Không có địa chỉ nhận: cần email TC/duyệt hoặc email GV thay.',
          },
          { status: 400 },
        );
      }

      const cc = ccExcludingTo([d.teacher_email], to);

      const sendResult = await sendMail({
        to,
        cc: cc.length > 0 ? cc : undefined,
        subject: `[MindX | THÔNG BÁO XIN NGHỈ 1 BUỔI] Đã duyệt & GV thay đã xác nhận — ${d.teacher_name}`,
        html,
      });

      return NextResponse.json({
        success: true,
        sent: sendResult.sent,
        warning: sendResult.warning,
        recipients: { to, cc },
      });
    }

    if (type === 'leave_admin_rejected') {
      const d = data as LeaveAdminRejectedPayload;
      const teacherTo = String(d?.teacher_email ?? '').trim();
      if (!d?.teacher_name || !d?.request_id || !teacherTo) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Missing required fields: teacher_name, request_id, teacher_email',
          },
          { status: 400 },
        );
      }

      const html = renderTemplate('leave-admin-rejected', {
        request_id: d.request_id,
        teacher_name: d.teacher_name,
        campus: d.campus || '—',
        class_code: d.class_code || '—',
        leave_date: formatDate(d.leave_date) || '—',
        class_time: d.class_time || '—',
        leave_session: d.leave_session || '—',
        reason: d.reason?.trim() || '—',
        admin_note: d.admin_note?.trim() || '',
        admin_name: d.admin_name || '—',
        admin_email: d.admin_email || '—',
      });

      const cc = uniqueRecipientEmails(d.admin_email);

      const sendResult = await sendMail({
        to: [teacherTo],
        cc: cc.length > 0 ? cc : undefined,
        subject: `[MindX | Xin nghỉ 1 buổi] Yêu cầu không được duyệt — ${d.teacher_name}`,
        html,
      });

      return NextResponse.json({
        success: true,
        sent: sendResult.sent,
        warning: sendResult.warning,
        recipients: { to: [teacherTo], cc },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported email type' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error('[emails/route] error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
