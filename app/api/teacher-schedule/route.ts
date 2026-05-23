import { NextRequest, NextResponse } from 'next/server';
import { fetchTeacherSchedules } from '@/lib/teacher-schedule-service';
import pool from '@/lib/db';
import { findTeacherRowByEmailOrCode } from '@/lib/teacher-profile-bundle';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const identifier = searchParams.get('teacherCode'); // Đây hiện tại là email từ frontend
  const authHeader = req.headers.get('authorization') ?? undefined;

  console.log(`[DEBUG] Request received with identifier: ${identifier}`);
  console.log(`[DEBUG] AuthHeader present: ${!!authHeader}`);

  if (!identifier) {
    return NextResponse.json({ error: 'teacherCode/email is required' }, { status: 400 });
  }

  try {
    // 1. Tra cứu mã giáo viên (code) từ email trong database
    const teacherRow = await findTeacherRowByEmailOrCode(pool, { email: identifier });
    
    if (!teacherRow) {
      console.log(`[DEBUG] No teacher found in DB for identifier: ${identifier}`);
      return NextResponse.json({ error: 'Không tìm thấy thông tin giáo viên trong hệ thống' }, { status: 404 });
    }

    const actualTeacherCode = String(teacherRow.code ?? "").trim();
    console.log(`[DEBUG] Resolved identifier ${identifier} to actualTeacherCode: ${actualTeacherCode}`);

    if (!actualTeacherCode) {
      return NextResponse.json({ error: 'Giáo viên không có mã định danh (code)' }, { status: 404 });
    }

    // 2. Sử dụng mã giáo viên và email để gọi LMS API (thử cả hai)
    const schedule = await fetchTeacherSchedules(actualTeacherCode, identifier, authHeader);
    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error(`[ERROR] API Route Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
