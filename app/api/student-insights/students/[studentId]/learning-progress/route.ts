import { NextRequest, NextResponse } from 'next/server';
import { requireDatasourceBearer } from '@/lib/datasource-api-auth';
import { getStudentLearningProgress } from '@/lib/student-insights/service';
import { resolveTeacherLmsId } from '@/lib/student-insights/teacher-resolver';

function parseDateParam(value: string | null, label: string): Date {
  if (!value) throw new Error(`Missing query param: ${label}`);
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date for ${label}`);
  return dt;
}

function parseInsightsQuery(request: NextRequest): {
  from: Date;
  to: Date;
  classId?: string;
} {
  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get('from'), 'from');
  const to = parseDateParam(searchParams.get('to'), 'to');
  const classId = searchParams.get('classId')?.trim() || undefined;
  if (from.getTime() > to.getTime()) throw new Error('from must be <= to');
  return { from, to, classId };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const authResult = await requireDatasourceBearer(request);
    if (!authResult.ok) return authResult.response;

    const teacher = await resolveTeacherLmsId(
      authResult.sessionEmail,
      request.headers.get('authorization') ?? undefined,
    );

    const { studentId } = await context.params;
    if (!studentId?.trim()) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });
    }

    const { from, to, classId } = parseInsightsQuery(request);
    const items = await getStudentLearningProgress(
      studentId,
      from,
      to,
      classId,
      teacher?.lmsTeacherId,
    );

    return NextResponse.json({
      studentId,
      from: from.toISOString(),
      to: to.toISOString(),
      classId: classId ?? null,
      total: items.length,
      items,
    });
  } catch (error: any) {
    console.error('Student learning progress API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.message?.includes('Missing') ? 400 : 500 }
    );
  }
}
