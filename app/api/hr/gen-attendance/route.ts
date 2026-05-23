import { requireBearerSession } from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function normalizeValue(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}
function normalizeEmail(input: unknown): string {
  return normalizeValue(input).toLowerCase();
}

async function validateAccess(requestEmail: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const result = await pool.query(
    `SELECT id, role, is_active FROM app_users WHERE email = $1 LIMIT 1`,
    [requestEmail]
  );
  if (result.rows.length === 0 || !result.rows[0].is_active) {
    return { ok: false, status: 403, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' };
  }
  return { ok: true, status: 200 };
}

// ─── GET: Lấy toàn bộ bản ghi điểm danh cho 1 GEN ───────────────────────────
const handleGet = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const requestEmail = auth.sessionEmail;
    const genCode = normalizeValue(searchParams.get('gen'));

    if (!genCode) return NextResponse.json({ error: 'gen là bắt buộc.' }, { status: 400 });

    const access = await validateAccess(requestEmail);
    if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

    const result = await pool.query(
      `SELECT candidate_key, session_number, attendance, score, recorded_by_email, updated_at
       FROM hr_gen_attendance_records
       WHERE gen_code = $1
       ORDER BY candidate_key, session_number`,
      [genCode]
    );

    // Group by candidateKey → { [sessionNumber]: { attendance, score } }
    const grouped: Record<string, Record<number, { attendance: boolean; score: number | null }>> = {};
    for (const row of result.rows as Array<{
      candidate_key: string;
      session_number: number;
      attendance: boolean;
      score: string | null;
    }>) {
      if (!grouped[row.candidate_key]) grouped[row.candidate_key] = {};
      grouped[row.candidate_key][row.session_number] = {
        attendance: Boolean(row.attendance),
        score: row.score !== null ? Number(row.score) : null,
      };
    }

    return NextResponse.json({ success: true, records: grouped });
  } catch (error) {
    console.error('gen-attendance GET error:', error);
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 });
  }
};

// ─── PATCH: Ghi / cập nhật bản ghi điểm danh ───────────────────────────────
// Body: { requestEmail, genCode, records: [{ candidateKey, sessionNumber, attendance, score }] }
const handlePatch = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const requestEmail = auth.sessionEmail;
    const genCode = normalizeValue(body.genCode);
    const records = Array.isArray(body.records) ? body.records : [];
    if (!genCode) return NextResponse.json({ error: 'genCode là bắt buộc.' }, { status: 400 });
    if (records.length === 0) return NextResponse.json({ error: 'records không được rỗng.' }, { status: 400 });

    const access = await validateAccess(requestEmail);
    if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const rec of records as Array<{
        candidateKey: unknown;
        sessionNumber: unknown;
        attendance: unknown;
        score: unknown;
      }>) {
        const candidateKey = normalizeValue(rec.candidateKey);
        const sessionNumber = Number(rec.sessionNumber);
        if (!candidateKey || isNaN(sessionNumber) || sessionNumber < 1 || sessionNumber > 4) continue;

        const rawScore = rec.score;
        const score =
          rawScore === null || rawScore === undefined || rawScore === ''
            ? null
            : Math.max(0, Math.min(10, Number(rawScore)));

        await client.query(
          `INSERT INTO hr_gen_attendance_records
             (candidate_key, gen_code, session_number, attendance, score, recorded_by_email)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (candidate_key, session_number)
           DO UPDATE SET
             gen_code          = EXCLUDED.gen_code,
             attendance        = EXCLUDED.attendance,
             score             = EXCLUDED.score,
             recorded_by_email = EXCLUDED.recorded_by_email,
             updated_at        = CURRENT_TIMESTAMP`,
          [candidateKey, genCode, sessionNumber, Boolean(rec.attendance), score, requestEmail]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, saved: records.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('gen-attendance PATCH error:', error);
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 });
  }
};

export const GET = withApiProtection(handleGet);
export const PATCH = withApiProtection(handlePatch);
