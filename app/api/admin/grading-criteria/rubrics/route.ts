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
      return NextResponse.json(
        { error: 'Không có quyền truy cập. Chức năng chỉ dành cho Admin.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type'); // 'course' | 'common' | null

    const query = `
      SELECT 
        r.id,
        r.name,
        r.type,
        r.description,
        r.apply_to_all_courses,
        r.created_by,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT i.id)::int AS criteria_count,
        COUNT(DISTINCT i.group_name)::int AS group_count,
        COALESCE(SUM(i.max_score), 0)::numeric AS total_max_score,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', rc.course_id,
                'name', rc.course_name,
                'code', rc.course_code
              )
            )
            FROM grading_rubric_courses rc
            WHERE rc.rubric_id = r.id
          ),
          '[]'::json
        ) AS assigned_courses
      FROM grading_rubrics r
      LEFT JOIN grading_rubric_items i ON i.rubric_id = r.id
      WHERE ($1::text IS NULL OR r.type = $1)
      GROUP BY r.id
      ORDER BY r.updated_at DESC, r.id DESC
    `;

    const res = await pool.query(query, [typeFilter || null]);

    const rubrics = res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description || '',
      applyToAllCourses: Boolean(row.apply_to_all_courses),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      criteriaCount: Number(row.criteria_count) || 0,
      groupCount: Number(row.group_count) || 0,
      totalMaxScore: Number(row.total_max_score) || 0,
      assignedCourses: row.assigned_courses || [],
    }));

    return NextResponse.json({
      success: true,
      total: rubrics.length,
      data: rubrics,
    });
  } catch (error: any) {
    console.error('[grading-criteria/rubrics GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi tải danh sách tiêu chí' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }
    const email = authSession.sessionEmail;

    const isAdmin = await isAppAdminByEmail(email);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Không có quyền truy cập. Chức năng chỉ dành cho Admin.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      type = 'course',
      description = '',
      applyToAllCourses = false,
      criteria = [],
      courses = [],
    } = body;

    let finalName = (name || '').trim();
    if (!finalName) {
      if (type === 'common') {
        finalName = 'Tiêu chí chấm điểm chung';
      } else if (Array.isArray(courses) && courses.length > 0) {
        finalName = courses.map((c: any) => c.name).slice(0, 3).join(', ') + (courses.length > 3 ? ` (+${courses.length - 3})` : '');
      } else {
        finalName = 'Bộ tiêu chí khóa học';
      }
    }

    if (type !== 'common' && !applyToAllCourses && (!Array.isArray(courses) || courses.length === 0)) {
      return NextResponse.json({ error: 'Vui lòng chọn ít nhất một khóa học áp dụng' }, { status: 400 });
    }

    await client.query('BEGIN');

    let rubricId = id ? Number(id) : null;

    if (rubricId) {
      // Cập nhật rubric đã có
      await client.query(
        `UPDATE grading_rubrics 
         SET name = $1, type = $2, description = $3, apply_to_all_courses = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [finalName, type, description, Boolean(applyToAllCourses), rubricId]
      );
    } else {
      // Tạo rubric mới
      const insertRes = await client.query(
        `INSERT INTO grading_rubrics (name, type, description, apply_to_all_courses, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [finalName, type, description, Boolean(applyToAllCourses), email]
      );
      rubricId = insertRes.rows[0].id;
    }

    // Cập nhật danh sách tiêu chí items (nếu có truyền)
    if (Array.isArray(criteria) && criteria.length > 0) {
      await client.query('DELETE FROM grading_rubric_items WHERE rubric_id = $1', [rubricId]);

      for (let i = 0; i < criteria.length; i++) {
        const item = criteria[i];
        await client.query(
          `INSERT INTO grading_rubric_items (rubric_id, group_name, content, max_score, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            rubricId,
            (item.groupName || 'Tiêu chí chung').trim(),
            (item.content || '').trim(),
            Number(item.maxScore) || 0.25,
            item.orderIndex !== undefined ? Number(item.orderIndex) : i,
          ]
        );
      }
    }

    // Cập nhật danh sách khóa học gán
    if (Array.isArray(courses)) {
      await client.query('DELETE FROM grading_rubric_courses WHERE rubric_id = $1', [rubricId]);

      for (const c of courses) {
        if (!c?.id) continue;
        await client.query(
          `INSERT INTO grading_rubric_courses (rubric_id, course_id, course_name, course_code)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (rubric_id, course_id) DO NOTHING`,
          [rubricId, String(c.id), (c.name || '').trim(), (c.code || '').trim()]
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      rubricId,
      message: 'Lưu bộ tiêu chí thành công',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[grading-criteria/rubrics POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi lưu bộ tiêu chí' }, { status: 500 });
  } finally {
    client.release();
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
      return NextResponse.json(
        { error: 'Không có quyền truy cập. Chức năng chỉ dành cho Admin.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu id bộ tiêu chí' }, { status: 400 });
    }

    const res = await pool.query('DELETE FROM grading_rubrics WHERE id = $1', [Number(id)]);

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy bộ tiêu chí cần xóa' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa bộ tiêu chí thành công',
    });
  } catch (error: any) {
    console.error('[grading-criteria/rubrics DELETE] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi xóa bộ tiêu chí' }, { status: 500 });
  }
}
