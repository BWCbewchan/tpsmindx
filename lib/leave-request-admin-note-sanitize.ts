/**
 * Log hệ thống khi GV thay từ chối được nối vào `admin_note` (tách bằng \\n\\n---\\n).
 * Phần này chỉ dành cho TC/admin xem toàn bộ; API trả cho GV cần ẩn.
 */
export const SUBSTITUTE_DECLINE_AUDIT_PREFIX =
  'Đã từ chối nhận lớp thay (GV được phân).';

export function stripSubstituteDeclineAuditFromAdminNote(
  adminNote: string | null | undefined,
): string | null {
  if (adminNote == null) return null;
  const raw = String(adminNote);
  if (!raw.trim()) return null;
  const parts = raw.split(/\n\n---\n/);
  const kept = parts.filter((segment) => {
    const t = segment.trim();
    if (!t) return false;
    return !t.startsWith(SUBSTITUTE_DECLINE_AUDIT_PREFIX);
  });
  const joined = kept.join('\n\n---\n').trim();
  return joined.length > 0 ? joined : null;
}

export function withAdminNoteRedactedForTeacherView<
  T extends Record<string, unknown>,
>(row: T): T {
  const admin_note = stripSubstituteDeclineAuditFromAdminNote(
    row.admin_note as string | null | undefined,
  );
  return { ...row, admin_note } as T;
}

/** Các khối log GV thay từ chối (nối bằng \\n\\n---\\n) — giữ khi TC sửa ghi chú. */
export function extractSubstituteDeclineAuditTail(
  adminNote: string | null | undefined,
): string {
  if (adminNote == null) return '';
  const raw = String(adminNote);
  if (!raw.trim()) return '';
  const parts = raw.split(/\n\n---\n/);
  const audits = parts
    .map((s) => s.trim())
    .filter(
      (t) =>
        t.length > 0 && t.startsWith(SUBSTITUTE_DECLINE_AUDIT_PREFIX),
    );
  if (audits.length === 0) return '';
  return audits.join('\n\n---\n');
}

/** Ghi chú TC sau chỉnh sửa + phần log từ chối GV thay (nếu có). */
export function mergeAdminNoteWithDeclineAudits(
  editedTcNote: string,
  originalFullAdminNote: string | null | undefined,
): string {
  const tail = extractSubstituteDeclineAuditTail(originalFullAdminNote);
  const tc = editedTcNote.trim();
  if (!tail) return tc;
  if (!tc) return tail;
  return `${tc}\n\n---\n${tail}`;
}
