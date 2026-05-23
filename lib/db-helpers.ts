import pool from '@/lib/db';
import { isDatabaseUnavailableError, isDegradedDatabaseQueryError } from '@/lib/db-unavailable';

export { isDatabaseUnavailableError, isDegradedDatabaseQueryError };

export type TeacherExistsBrief = {
  exists: boolean;
  /** true khi không query được DB — không nên coi `exists` là “chắc chắn không có bản ghi”. */
  dbUnavailable: boolean;
};

/**
 * Giống {@link checkTeacherExistsByEmail} nhưng phân biệt “không có trong bảng” với “DB tạm không truy vấn được”.
 */
export async function checkTeacherExistsByEmailDetailed(
  email: string,
): Promise<TeacherExistsBrief> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM teachers
       WHERE LOWER(TRIM(work_email)) = LOWER(TRIM($1))
          OR LOWER(TRIM("Work email")) = LOWER(TRIM($1))
       LIMIT 1`,
      [email],
    );
    return { exists: result.rows.length > 0, dbUnavailable: false };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === '42P01') {
      console.warn('teachers table does not exist yet');
      return { exists: false, dbUnavailable: false };
    }
    if (isDatabaseUnavailableError(error)) {
      console.warn('DB unavailable during teacher check');
      return { exists: false, dbUnavailable: true };
    }
    throw error;
  }
}

/**
 * Check whether a teacher record exists in the `teachers` table by work email.
 * Returns `false` (instead of throwing) when the table doesn't exist yet or
 * the database is temporarily unreachable, so callers can degrade gracefully.
 */
export async function checkTeacherExistsByEmail(email: string): Promise<boolean> {
  const r = await checkTeacherExistsByEmailDetailed(email);
  if (r.dbUnavailable) return false;
  return r.exists;
}
