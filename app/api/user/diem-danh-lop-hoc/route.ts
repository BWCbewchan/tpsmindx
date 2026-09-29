import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COUNT = 14;
const ITEMS_PER_PAGE = 200;
const MAX_PAGES = 20;

const GET_ATTENDANCE_CLASSES_QUERY = /* graphql */ `
  query GetAllClasses($haveSlotFrom: Date, $haveSlotTo: Date, $pageIndex: Int, $itemsPerPage: Int) {
    classes(payload: {
      haveSlot_from: $haveSlotFrom,
      haveSlot_to: $haveSlotTo,
      status_in: ["RUNNING", "PREPARING"],
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: "startDate_asc"
    }) {
      pagination { total }
      data {
        id
        name
        status
        startDate
        endDate
        numberOfSessions
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id fullName username code email imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName phoneNumber email imageUrl }
        }
        slots {
          _id
          date
          startTime
          endTime
          sessionHour
          summary
          homework
          teachers {
            _id
            isActive
            teacher { id fullName username code email imageUrl }
            role { id name shortName }
          }
          teacherAttendance {
            _id
            status
            note
            teacher { id fullName email }
          }
          studentAttendance {
            _id
            status
            comment
            sendCommentStatus
            commentByAreas {
              content
              grade
              commentAreaId
              type
              courseProcessFinalEvaluationTitle
            }
            student { id fullName phoneNumber email gender imageUrl }
          }
        }
      }
    }
  }
`;

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function isLecAssignment(assignment: any, userEmail: string): boolean {
  if (assignment?.isActive === false) return false;

  const teacherEmail = normalizeEmail(assignment?.teacher?.email);
  if (!teacherEmail || teacherEmail !== userEmail) return false;

  const roleValues = [
    assignment?.role?.shortName,
    assignment?.role?.name,
    assignment?.role?.code,
  ].map(normalizeStatus);

  return roleValues.includes('LEC');
}

function hasMatchingTeacherAttendance(slot: any, userEmail: string): boolean {
  return (slot?.teacherAttendance || []).some(
    (attendance: any) => normalizeEmail(attendance?.teacher?.email) === userEmail,
  );
}

function hasTeacherAccessToClass(cls: any, userEmail: string): boolean {
  const hasLecRole =
    (cls?.teachers || []).some((teacher: any) => isLecAssignment(teacher, userEmail)) ||
    (cls?.slots || []).some((slot: any) =>
      (slot?.teachers || []).some((teacher: any) => isLecAssignment(teacher, userEmail)),
    );

  const hasAttendedSlot = (cls?.slots || []).some((slot: any) =>
    hasMatchingTeacherAttendance(slot, userEmail),
  );

  return hasLecRole || hasAttendedSlot;
}

function dateInputToIso(value: string | null, endOfDay: boolean): string {
  if (value) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`).toISOString();
  }

  const date = new Date();
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  date.setDate(date.getDate() + (endOfDay ? 240 : -120));
  return date.toISOString();
}

function toDateKey(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.split('T')[0] || text;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function compareDateLike(a: any, b: any): number {
  return (
    new Date(a?.date || a?.startTime || 0).getTime() -
    new Date(b?.date || b?.startTime || 0).getTime()
  );
}

function mapStudent(studentRow: any) {
  const student = studentRow?.student || {};
  return {
    id: String(student.id || studentRow?._id || ''),
    fullName: String(student.fullName || '').trim() || 'Học viên',
    phoneNumber: student.phoneNumber || null,
    email: student.email || null,
    imageUrl: student.imageUrl || null,
    activeInClass: studentRow?.activeInClass !== false,
  };
}

function mapAttendance(attendance: any) {
  const student = attendance?.student || {};
  return {
    id: attendance?._id || null,
    status: normalizeStatus(attendance?.status) || 'NOT_RECORDED',
    comment: attendance?.comment || '',
    sendCommentStatus: attendance?.sendCommentStatus || null,
    commentByAreas: Array.isArray(attendance?.commentByAreas) ? attendance.commentByAreas : [],
    student: {
      id: String(student.id || ''),
      fullName: student.fullName || '',
      phoneNumber: student.phoneNumber || null,
      email: student.email || null,
      gender: student.gender || null,
      imageUrl: student.imageUrl || null,
    },
  };
}

function mapSlot(slot: any, index: number, studentsCount: number) {
  const attendances = Array.isArray(slot?.studentAttendance)
    ? slot.studentAttendance.map(mapAttendance)
    : [];
  const recordedCount = attendances.filter(
    (attendance: { status: string }) => attendance.status && attendance.status !== 'NOT_RECORDED',
  ).length;

  return {
    id: String(slot?._id || `session-${index + 1}`),
    sessionNumber: index + 1,
    date: slot?.date || slot?.startTime || null,
    dateKey: toDateKey(slot?.date || slot?.startTime),
    startTime: slot?.startTime || null,
    endTime: slot?.endTime || null,
    sessionHour: slot?.sessionHour ?? null,
    summary: slot?.summary || '',
    homework: slot?.homework || '',
    teacherAttendance: Array.isArray(slot?.teacherAttendance) ? slot.teacherAttendance : [],
    studentAttendance: attendances,
    recordedCount,
    studentsCount,
  };
}

function mapClass(cls: any) {
  const students = (cls?.students || [])
    .filter((row: any) => row?.activeInClass !== false)
    .map(mapStudent)
    .filter((student: { id: string }) => Boolean(student.id))
    .sort((a: { fullName: string }, b: { fullName: string }) =>
      a.fullName.localeCompare(b.fullName, 'vi'),
    );

  const slots = (cls?.slots || [])
    .slice()
    .sort(compareDateLike)
    .slice(0, SESSION_COUNT)
    .map((slot: any, index: number) => mapSlot(slot, index, students.length));

  const lecTeachers = (cls?.teachers || [])
    .filter((teacher: any) => teacher?.isActive !== false)
    .filter((teacher: any) =>
      [teacher?.role?.shortName, teacher?.role?.name].map(normalizeStatus).includes('LEC'),
    )
    .map((teacher: any) => teacher?.teacher?.fullName)
    .filter(Boolean);

  return {
    id: String(cls?.id || ''),
    name: String(cls?.name || '').trim() || 'Lớp học',
    status: normalizeStatus(cls?.status) || 'UNKNOWN',
    startDate: cls?.startDate || null,
    endDate: cls?.endDate || null,
    sessionCount: SESSION_COUNT,
    numberOfSessions: Number(cls?.numberOfSessions || SESSION_COUNT) || SESSION_COUNT,
    courseName: cls?.course?.name || '',
    courseShortName: cls?.course?.shortName || '',
    courseLineName: cls?.course?.courseLine?.name || '',
    centreName: cls?.centre?.shortName || cls?.centre?.name || '',
    lecTeachers: Array.from(new Set(lecTeachers)),
    students,
    slots,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const userEmail = normalizeEmail(auth.sessionEmail);
  const firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';

  if (!firebaseToken) {
    return NextResponse.json({
      success: false,
      noLmsToken: true,
      classes: [],
      message: 'Tài khoản này chưa có kết nối LMS.',
    });
  }

  try {
    const fromParam = request.nextUrl.searchParams.get('from');
    const toParam = request.nextUrl.searchParams.get('to');
    const haveSlotFrom = dateInputToIso(fromParam, false);
    const haveSlotTo = dateInputToIso(toParam, true);
    const authHeader = `Bearer ${firebaseToken}`;

    const firstResult = await callLmsApi<any>(
      {
        query: GET_ATTENDANCE_CLASSES_QUERY,
        operationName: 'GetAllClasses',
        variables: {
          haveSlotFrom,
          haveSlotTo,
          pageIndex: 0,
          itemsPerPage: ITEMS_PER_PAGE,
        },
      },
      authHeader,
    );

    const firstPage = firstResult.data?.classes;
    const allClasses = Array.isArray(firstPage?.data) ? [...firstPage.data] : [];
    const total = Number(firstPage?.pagination?.total || allClasses.length);
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    for (let pageIndex = 1; pageIndex < totalPages && pageIndex < MAX_PAGES; pageIndex++) {
      const pageResult = await callLmsApi<any>(
        {
          query: GET_ATTENDANCE_CLASSES_QUERY,
          operationName: 'GetAllClasses',
          variables: {
            haveSlotFrom,
            haveSlotTo,
            pageIndex,
            itemsPerPage: ITEMS_PER_PAGE,
          },
        },
        authHeader,
      );

      const pageData = pageResult.data?.classes?.data;
      if (!Array.isArray(pageData) || pageData.length === 0) break;
      allClasses.push(...pageData);
    }

    const uniqueClasses = Array.from(
      new Map(
        allClasses
          .filter((cls: any) => hasTeacherAccessToClass(cls, userEmail))
          .map((cls: any) => [String(cls.id), cls]),
      ).values(),
    );

    const classes = uniqueClasses
      .map(mapClass)
      .filter((cls) => cls.id)
      .sort((a, b) => {
        const aTime = new Date(a.startDate || a.slots[0]?.date || 0).getTime();
        const bTime = new Date(b.startDate || b.slots[0]?.date || 0).getTime();
        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      classes,
      meta: {
        from: haveSlotFrom,
        to: haveSlotTo,
        totalFetched: allClasses.length,
        totalMatched: classes.length,
        sessionCount: SESSION_COUNT,
      },
    });
  } catch (error: unknown) {
    console.error('[diem-danh-lop-hoc] Error:', error);
    const message = error instanceof Error ? error.message : 'Không thể kết nối LMS API.';
    return NextResponse.json(
      {
        success: false,
        classes: [],
        message,
      },
      { status: 500 },
    );
  }
}
