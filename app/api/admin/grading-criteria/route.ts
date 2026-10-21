import { NextRequest, NextResponse } from 'next/server';
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { isAppAdminByEmail } from '@/lib/is-app-admin';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }
    const email = authSession.sessionEmail;

    const isAdmin = await isAppAdminByEmail(email);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: 'Thiếu courseId' }, { status: 400 });
    }

    const res = await pool.query(
      `SELECT id, course_id, course_name, course_code, group_name, content, max_score, order_index, created_by, updated_at
       FROM course_grading_criteria
       WHERE course_id = $1
       ORDER BY order_index ASC, id ASC`,
      [courseId]
    );

    const rows = res.rows.map((r: any) => ({
      id: r.id,
      courseId: r.course_id,
      courseName: r.course_name,
      courseCode: r.course_code,
      groupName: r.group_name,
      content: r.content,
      maxScore: Number(r.max_score) || 0,
      orderIndex: r.order_index,
      createdBy: r.created_by,
      updatedAt: r.updated_at,
    }));

    // Gom nhóm theo groupName để dễ dàng hiển thị theo cấu trúc bảng điểm
    const groupsMap = new Map<string, { groupName: string; totalGroupScore: number; items: typeof rows }>();
    rows.forEach((item: any) => {
      if (!groupsMap.has(item.groupName)) {
        groupsMap.set(item.groupName, {
          groupName: item.groupName,
          totalGroupScore: 0,
          items: [],
        });
      }
      const g = groupsMap.get(item.groupName)!;
      g.items.push(item);
      g.totalGroupScore = Math.round((g.totalGroupScore + item.maxScore) * 1000) / 1000;
    });

    const totalMaxScore = rows.reduce((sum: number, r: any) => sum + r.maxScore, 0);

    return NextResponse.json({
      success: true,
      courseId,
      totalCriteria: rows.length,
      totalMaxScore: Math.round(totalMaxScore * 1000) / 1000,
      groups: Array.from(groupsMap.values()),
      data: rows,
    });
  } catch (error: any) {
    console.error('[grading-criteria] GET error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải tiêu chí' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }
    const email = authSession.sessionEmail;

    const isAdmin = await isAppAdminByEmail(email);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await request.json();
    const { courseId, courseName, courseCode, criteria } = body;

    if (!courseId || !courseName) {
      return NextResponse.json({ error: 'Thiếu thông tin khóa học (courseId, courseName)' }, { status: 400 });
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json({ error: 'Danh sách tiêu chí không được rỗng' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Xóa các tiêu chí cũ của khóa học này
      await client.query('DELETE FROM course_grading_criteria WHERE course_id = $1', [courseId]);

      // 2. Chèn danh sách tiêu chí mới
      let orderIndex = 0;
      for (const item of criteria) {
        const groupName = String(item.groupName || item.group || 'Tiêu chí chung').trim();
        const content = String(item.content || item.description || '').trim();
        const maxScore = typeof item.maxScore === 'number' ? item.maxScore : parseFloat(String(item.maxScore || '0.25')) || 0.25;

        if (!content) continue; // Bỏ qua dòng trống

        await client.query(
          `INSERT INTO course_grading_criteria (
            course_id, course_name, course_code, group_name, content, max_score, order_index, created_by, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
          [courseId, courseName, courseCode || null, groupName, content, maxScore, orderIndex++, email]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Đã lưu thành công ${orderIndex} tiêu chí cho khóa học "${courseName}"`,
        totalSaved: orderIndex,
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[grading-criteria] POST error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi lưu tiêu chí' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }
    const email = authSession.sessionEmail;

    const isAdmin = await isAppAdminByEmail(email);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: 'Thiếu courseId' }, { status: 400 });
    }

    const res = await pool.query('DELETE FROM course_grading_criteria WHERE course_id = $1', [courseId]);

    return NextResponse.json({
      success: true,
      message: `Đã xóa ${res.rowCount} tiêu chí của khóa học`,
    });
  } catch (error: any) {
    console.error('[grading-criteria] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi xóa tiêu chí' }, { status: 500 });
  }
}
