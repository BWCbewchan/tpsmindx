/**
 * Postgres / network signals that the DB should be treated as temporarily unavailable.
 * Kept separate from db-helpers to avoid circular imports (db → migrations → …).
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();

  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ENETUNREACH' ||
    code === 'EAI_AGAIN' ||
    code === '08001' ||
    code === '08006' ||
    code === '08003' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '28000' ||
    code === '53300'
  ) {
    return true;
  }
  return (
    msg.includes('connection terminated') ||
    msg.includes('connection closed') ||
    msg.includes('no pg_hba.conf entry') ||
    msg.includes('server closed the connection') ||
    msg.includes('remaining connection slots') ||
    msg.includes('too many connections')
  );
}

/**
 * Kết nối được nhưng query không chạy được an toàn (bảng chưa migrate, v.v.).
 * Trả empty thay vì 500 cho các API đọc dữ liệu.
 */
export function isDegradedDatabaseQueryError(error: unknown): boolean {
  if (isDatabaseUnavailableError(error)) return true;
  const err = error as { code?: string; message?: string };
  if (err?.code === '42P01') return true;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}
