import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { candidate_id, center_code, observe_date, class_type, harvest_file_url } = await request.json();

    if (!candidate_id || !center_code || !observe_date || !class_type || !harvest_file_url) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO hr_observe_sessions (candidate_id, center_code, observe_date, class_type, harvest_file_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [candidate_id, center_code, observe_date, class_type, harvest_file_url]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Candidate Portal Observe POST]', error);
    return NextResponse.json({ success: false, error: 'Lỗi khi nộp bài thu hoạch' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const candidate_id = searchParams.get('candidate_id');

    if (!candidate_id) {
      return NextResponse.json({ success: false, error: 'candidate_id là bắt buộc' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT * FROM hr_observe_sessions WHERE candidate_id = $1 ORDER BY observe_date DESC`,
      [candidate_id]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Candidate Portal Observe GET]', error);
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách bài thu hoạch' }, { status: 500 });
  }
}