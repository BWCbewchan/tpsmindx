import { NextRequest, NextResponse } from 'next/server';
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';

    if (!classId) {
      return NextResponse.json({ error: 'Thiếu classId' }, { status: 400 });
    }

    // Nếu không truyền studentId, trả về danh sách tóm tắt tất cả học viên đã có điểm trong lớp
    if (!studentId) {
      const summaryQuery = `
        SELECT 
          student_id AS "studentId",
          total_score AS "totalScore",
          max_possible_score AS "maxPossibleScore",
          updated_at AS "updatedAt"
        FROM student_demo_grades
        WHERE class_id = $1
      `;
      const summaryRes = await pool.query(summaryQuery, [classId]);
      return NextResponse.json({
        success: true,
        data: summaryRes.rows,
      });
    }

    const query = `
      SELECT 
        id,
        class_id AS "classId",
        student_id AS "studentId",
        course_id AS "courseId",
        teacher_id AS "teacherId",
        teacher_email AS "teacherEmail",
        project_type AS "projectType",
        criteria_scores AS "criteriaScores",
        total_score AS "totalScore",
        max_possible_score AS "maxPossibleScore",
        note,
        bgk2_note AS "bgk2Note",
        demo_date AS "demoDate",
        eval_date AS "evalDate",
        updated_by_name AS "updatedByName",
        updated_by_email AS "updatedByEmail",
        graded_at AS "gradedAt",
        updated_at AS "updatedAt"
      FROM student_demo_grades
      WHERE class_id = $1 AND student_id = $2
      LIMIT 1
    `;

    const res = await pool.query(query, [classId, studentId]);

    return NextResponse.json({
      success: true,
      data: res.rows[0] || null,
    });
  } catch (error: any) {
    console.error('[student-demo-grade GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi tải kết quả chấm điểm' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSession = await requireBearerOrSessionCookie(request);
    if (!authSession.ok) {
      return authSession.response;
    }

    const email = authSession.sessionEmail || '';
    const teacherId = authSession.sessionEmail || '';

    const body = await request.json();
    const {
      classId,
      studentId,
      courseId,
      projectType,
      criteriaScores,
      totalScore,
      maxPossibleScore,
      note,
      bgk2Note,
      demoDate,
      evalDate,
      updatedByName,
    } = body;

    if (!classId || !studentId) {
      return NextResponse.json({ error: 'Thiếu classId hoặc studentId' }, { status: 400 });
    }

    const updaterName = String(updatedByName || email || 'Giảng viên');
    const updaterEmail = String(email || '');

    const upsertQuery = `
      INSERT INTO student_demo_grades (
        class_id,
        student_id,
        course_id,
        teacher_id,
        teacher_email,
        project_type,
        criteria_scores,
        total_score,
        max_possible_score,
        note,
        bgk2_note,
        demo_date,
        eval_date,
        updated_by_name,
        updated_by_email,
        graded_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (class_id, student_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        teacher_id = EXCLUDED.teacher_id,
        teacher_email = EXCLUDED.teacher_email,
        project_type = EXCLUDED.project_type,
        criteria_scores = EXCLUDED.criteria_scores,
        total_score = EXCLUDED.total_score,
        max_possible_score = EXCLUDED.max_possible_score,
        note = EXCLUDED.note,
        bgk2_note = EXCLUDED.bgk2_note,
        demo_date = EXCLUDED.demo_date,
        eval_date = EXCLUDED.eval_date,
        updated_by_name = EXCLUDED.updated_by_name,
        updated_by_email = EXCLUDED.updated_by_email,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        class_id AS "classId",
        student_id AS "studentId",
        course_id AS "courseId",
        project_type AS "projectType",
        criteria_scores AS "criteriaScores",
        total_score AS "totalScore",
        max_possible_score AS "maxPossibleScore",
        note,
        bgk2_note AS "bgk2Note",
        demo_date AS "demoDate",
        eval_date AS "evalDate",
        updated_by_name AS "updatedByName",
        updated_by_email AS "updatedByEmail",
        graded_at AS "gradedAt",
        updated_at AS "updatedAt"
    `;

    const res = await pool.query(upsertQuery, [
      String(classId),
      String(studentId),
      String(courseId || ''),
      String(teacherId),
      String(email),
      String(projectType || ''),
      JSON.stringify(criteriaScores || []),
      Number(totalScore) || 0,
      Number(maxPossibleScore) || 5.0,
      String(note || ''),
      String(bgk2Note || ''),
      String(demoDate || ''),
      String(evalDate || ''),
      updaterName,
      updaterEmail,
    ]);

    return NextResponse.json({
      success: true,
      message: 'Lưu điểm buổi demo học viên thành công',
      data: res.rows[0],
    });
  } catch (error: any) {
    console.error('[student-demo-grade POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi lưu bảng điểm học viên' }, { status: 500 });
  }
}
