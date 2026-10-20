import { NextRequest, NextResponse } from 'next/server';
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { isAppAdminByEmail } from '@/lib/is-app-admin';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }

    const { id } = await params;
    const rubricId = Number(id);
    if (!rubricId) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    // 1. Lấy thông tin rubric
    const rubricRes = await pool.query('SELECT * FROM grading_rubrics WHERE id = $1', [rubricId]);
    if (rubricRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy bộ tiêu chí' }, { status: 404 });
    }
    const rubric = rubricRes.rows[0];

    // 2. Lấy các items tiêu chí
    const itemsRes = await pool.query(
      'SELECT id, group_name, content, max_score, order_index FROM grading_rubric_items WHERE rubric_id = $1 ORDER BY order_index ASC, id ASC',
      [rubricId]
    );

    // 3. Lấy danh sách khóa học được gán
    const coursesRes = await pool.query(
      'SELECT course_id AS id, course_name AS name, course_code AS code FROM grading_rubric_courses WHERE rubric_id = $1',
      [rubricId]
    );

    // 4. Nhóm items theo group_name
    const groupMap = new Map<string, any>();
    let totalMaxScore = 0;

    itemsRes.rows.forEach((r: any) => {
      const gName = r.group_name || 'Tiêu chí chung';
      const score = Number(r.max_score) || 0;
      totalMaxScore += score;

      if (!groupMap.has(gName)) {
        groupMap.set(gName, {
          groupName: gName,
          items: [],
          totalGroupScore: 0,
        });
      }

      const g = groupMap.get(gName)!;
      g.items.push({
        id: r.id,
        content: r.content,
        maxScore: score,
        orderIndex: r.order_index,
      });
      g.totalGroupScore = Math.round((g.totalGroupScore + score) * 1000) / 1000;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: rubric.id,
        name: rubric.name,
        type: rubric.type,
        description: rubric.description || '',
        applyToAllCourses: Boolean(rubric.apply_to_all_courses),
        createdBy: rubric.created_by,
        createdAt: rubric.created_at,
        updatedAt: rubric.updated_at,
        totalMaxScore: Math.round(totalMaxScore * 1000) / 1000,
        groups: Array.from(groupMap.values()),
        assignedCourses: coursesRes.rows,
      },
    });
  } catch (error: any) {
    console.error('[grading-criteria/rubrics/[id] GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải chi tiết bộ tiêu chí' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const rubricId = Number(id);
    if (!rubricId) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    const body = await request.json();
    const { courses, name, description, applyToAllCourses } = body;

    await client.query('BEGIN');

    // Cập nhật thông tin cơ bản nếu có
    if (name !== undefined || description !== undefined || applyToAllCourses !== undefined) {
      await client.query(
        `UPDATE grading_rubrics 
         SET 
           name = COALESCE($1, name),
           description = COALESCE($2, description),
           apply_to_all_courses = COALESCE($3, apply_to_all_courses),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [
          name !== undefined ? name.trim() : null,
          description !== undefined ? description : null,
          applyToAllCourses !== undefined ? Boolean(applyToAllCourses) : null,
          rubricId,
        ]
      );
    }

    // Cập nhật danh sách khóa học gán nếu có
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
      message: 'Cập nhật bộ tiêu chí thành công',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[grading-criteria/rubrics/[id] PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật' }, { status: 500 });
  } finally {
    client.release();
  }
}
