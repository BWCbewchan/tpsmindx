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
    const courseId = (searchParams.get('courseId') || '').trim();
    const courseName = (searchParams.get('courseName') || '').trim();
    const courseShortName = (searchParams.get('courseShortName') || '').trim();
    const courseLineName = (searchParams.get('courseLineName') || '').trim();
    const className = (searchParams.get('className') || '').trim();

    if (!courseId && !courseName && !courseShortName && !className) {
      return NextResponse.json({ error: 'Thiếu thông tin khóa học' }, { status: 400 });
    }

    // 1. Truy vấn các bộ tiêu chí mới (grading_rubrics) gồm cả tiêu chí khóa học và tiêu chí chung
    const rubricQuery = `
      SELECT DISTINCT
        i.id,
        r.id AS rubric_id,
        r.name AS rubric_name,
        r.type AS rubric_type,
        CASE WHEN r.type = 'course' THEN 1 ELSE 2 END AS sort_type,
        COALESCE(rc.course_id, $1) AS course_id,
        COALESCE(rc.course_name, $2) AS course_name,
        rc.course_code,
        i.group_name,
        i.content,
        i.max_score,
        i.order_index
      FROM grading_rubrics r
      JOIN grading_rubric_items i ON i.rubric_id = r.id
      LEFT JOIN grading_rubric_courses rc ON rc.rubric_id = r.id
      WHERE (
        (r.type = 'course' AND (
          ($1 <> '' AND (rc.course_id = $1 OR rc.course_code = $1))
          OR ($2 <> '' AND (
            LOWER(TRIM(rc.course_name)) = LOWER(TRIM($2))
            OR LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(rc.course_name)) || '%'
            OR LOWER(TRIM(rc.course_name)) LIKE '%' || LOWER(TRIM($2)) || '%'
          ))
          OR ($3 <> '' AND (
            LOWER(TRIM(rc.course_code)) = LOWER(TRIM($3))
            OR LOWER(TRIM(rc.course_name)) = LOWER(TRIM($3))
          ))
          OR ($4 <> '' AND (
            LOWER(TRIM(rc.course_name)) = LOWER(TRIM($4))
            OR LOWER(TRIM($4)) LIKE '%' || LOWER(TRIM(rc.course_name)) || '%'
          ))
          OR ($5 <> '' AND LOWER(TRIM($5)) LIKE '%' || LOWER(TRIM(rc.course_name)) || '%')
        ))
        OR
        (r.type = 'common' AND (
          r.apply_to_all_courses = true 
          OR ($1 <> '' AND (rc.course_id = $1 OR rc.course_code = $1))
          OR ($2 <> '' AND (
            LOWER(TRIM(rc.course_name)) = LOWER(TRIM($2))
            OR LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(rc.course_name)) || '%'
          ))
        ))
      )
      ORDER BY 
        CASE WHEN r.type = 'course' THEN 1 ELSE 2 END,
        r.id ASC,
        i.order_index ASC,
        i.id ASC
    `;

    const rubricRes = await pool.query(rubricQuery, [
      courseId,
      courseName,
      courseShortName,
      courseLineName,
      className,
    ]);

    if (rubricRes.rows.length > 0) {
      return formatResponse(rubricRes.rows);
    }

    // 2. Fallback: Nếu chưa có trong bảng mới, truy vấn bảng cũ course_grading_criteria
    const legacyQuery = `
      SELECT id, course_id, course_name, course_code, group_name, content, max_score, order_index, 'course' AS rubric_type
      FROM course_grading_criteria
      WHERE 
        ($1 <> '' AND course_id = $1)
        OR ($2 <> '' AND (
          LOWER(TRIM(course_name)) = LOWER(TRIM($2))
          OR LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(course_name)) || '%'
        ))
        OR ($3 <> '' AND LOWER(TRIM(course_code)) = LOWER(TRIM($3)))
      ORDER BY order_index ASC, id ASC
    `;
    const legacyRes = await pool.query(legacyQuery, [courseId, courseName, courseShortName]);

    return formatResponse(legacyRes.rows);
  } catch (error: any) {
    console.error('[user/course-grading-criteria] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải tiêu chí khóa học' }, { status: 500 });
  }
}

function formatResponse(rows: any[]) {
  const hasCriteria = rows.length > 0;
  if (!hasCriteria) {
    return NextResponse.json({
      success: true,
      hasCriteria: false,
      hasCourseCriteria: false,
      hasCommonCriteria: false,
      weights: {
        courseWeight: 1.0,
        commonWeight: 0.0,
        courseWeightPercent: 100,
        commonWeightPercent: 0,
      },
      totalCriteria: 0,
      totalMaxScore: 0,
      groups: [],
      data: [],
    });
  }

  const items = rows.map((r: any) => ({
    id: r.id,
    rubricId: r.rubric_id,
    rubricName: r.rubric_name,
    rubricType: r.rubric_type || 'course', // 'course' hoặc 'common'
    courseId: r.course_id,
    courseName: r.course_name,
    courseCode: r.course_code,
    groupName: r.group_name,
    content: r.content,
    maxScore: Number(r.max_score) || 0,
    orderIndex: r.order_index,
  }));

  const hasCourse = items.some((item) => item.rubricType === 'course');
  const hasCommon = items.some((item) => item.rubricType === 'common');

  // Quy tắc trọng số theo yêu cầu:
  // - Nếu chỉ có 1 trong 2 loại được áp dụng cho khóa đó -> trọng số là 100%
  // - Nếu có CẢ HAI loại cùng áp dụng -> Chuyên môn 60% (0.6), Tiêu chí chung 40% (0.4)
  let courseWeight = 1.0;
  let commonWeight = 0.0;

  if (hasCourse && hasCommon) {
    courseWeight = 0.6;
    commonWeight = 0.4;
  } else if (!hasCourse && hasCommon) {
    courseWeight = 0.0;
    commonWeight = 1.0;
  } else {
    courseWeight = 1.0;
    commonWeight = 0.0;
  }

  const groupsMap = new Map<
    string,
    {
      groupName: string;
      rubricType: string;
      weight: number;
      weightPercent: number;
      totalGroupScore: number;
      items: typeof items;
    }
  >();

  items.forEach((item: any) => {
    const isCommon = item.rubricType === 'common';
    const key = `${item.rubricType}_${item.groupName}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        groupName: item.groupName,
        rubricType: item.rubricType,
        weight: isCommon ? commonWeight : courseWeight,
        weightPercent: Math.round((isCommon ? commonWeight : courseWeight) * 100),
        totalGroupScore: 0,
        items: [],
      });
    }
    const g = groupsMap.get(key)!;
    g.items.push(item);
    g.totalGroupScore = Math.round((g.totalGroupScore + item.maxScore) * 1000) / 1000;
  });

  const allGroups = Array.from(groupsMap.values());
  const courseItems = items.filter((i) => i.rubricType === 'course');
  const commonItems = items.filter((i) => i.rubricType === 'common');

  const courseMaxScore = Math.round(courseItems.reduce((sum, r) => sum + r.maxScore, 0) * 1000) / 1000;
  const commonMaxScore = Math.round(commonItems.reduce((sum, r) => sum + r.maxScore, 0) * 1000) / 1000;
  const totalMaxScore = Math.round(items.reduce((sum: number, r: any) => sum + r.maxScore, 0) * 1000) / 1000;

  return NextResponse.json({
    success: true,
    hasCriteria: true,
    hasCourseCriteria: hasCourse,
    hasCommonCriteria: hasCommon,
    weights: {
      courseWeight,
      commonWeight,
      courseWeightPercent: Math.round(courseWeight * 100),
      commonWeightPercent: Math.round(commonWeight * 100),
    },
    courseCriteria: {
      hasCriteria: hasCourse,
      weight: courseWeight,
      weightPercent: Math.round(courseWeight * 100),
      totalMaxScore: courseMaxScore,
      groups: allGroups.filter((g) => g.rubricType === 'course'),
      itemsCount: courseItems.length,
    },
    commonCriteria: {
      hasCriteria: hasCommon,
      weight: commonWeight,
      weightPercent: Math.round(commonWeight * 100),
      totalMaxScore: commonMaxScore,
      groups: allGroups.filter((g) => g.rubricType === 'common'),
      itemsCount: commonItems.length,
    },
    totalCriteria: items.length,
    totalMaxScore: totalMaxScore,
    groups: allGroups,
    data: items,
  });
}
