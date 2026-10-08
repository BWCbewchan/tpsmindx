import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COUNT = 14;
const ITEMS_PER_PAGE = 200;
const MAX_PAGES = 30;

const GET_ATTENDANCE_CLASSES_QUERY = /* graphql */ `
  query GetAllClasses(
    $search: String,
    $statusIn: [String],
    $haveSlotFrom: Date,
    $haveSlotTo: Date,
    $pageIndex: Int,
    $itemsPerPage: Int
  ) {
    classes(payload: {
      filter_textSearch: $search,
      haveSlot_from: $haveSlotFrom,
      haveSlot_to: $haveSlotTo,
      status_in: $statusIn,
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
        operationMethod { id name }
        operator { id username firstName middleName lastName }
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
          student {
            id
            fullName
            phoneNumber
            email
            gender
            imageUrl
            customer { fullName phoneNumber email facebook zalo }
          }
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
            teacher { id fullName username code email imageUrl }
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
            student {
              id
              fullName
              phoneNumber
              email
              gender
              imageUrl
              customer { fullName phoneNumber email facebook zalo }
            }
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

function normalizeRoleText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function roleValues(assignment: any): string[] {
  return [
    assignment?.role?.shortName,
    assignment?.role?.name,
    assignment?.role?.code,
  ].map(normalizeRoleText);
}

function teacherMatches(assignment: any, userEmail: string): boolean {
  if (assignment?.isActive === false) return false;

  const teacherEmail = normalizeEmail(assignment?.teacher?.email);
  return Boolean(teacherEmail && teacherEmail === userEmail);
}

function hasMatchingTeacherAttendance(slot: any, userEmail: string): boolean {
  return (slot?.teacherAttendance || []).some((attendance: any) => {
    return normalizeEmail(attendance?.teacher?.email) === userEmail;
  });
}

function isLecAssignment(assignment: any, userEmail: string): boolean {
  if (!teacherMatches(assignment, userEmail)) return false;

  return roleValues(assignment).some((role) =>
    role === 'LEC' ||
    role.includes('LECTURER') ||
    role.includes('GIANG VIEN')
  );
}

function isJudgeAssignment(assignment: any, userEmail: string): boolean {
  if (!teacherMatches(assignment, userEmail)) return false;

  return roleValues(assignment).some(
    (role) =>
      role === 'JUDGE' ||
      role === 'BGK' ||
      role.includes('BAN GIAM KHAO') ||
      role.includes('GIAM KHAO'),
  );
}

function sortedSlots(cls: any): any[] {
  return (cls?.slots || []).slice().sort(compareDateLike);
}

function teacherAccountFromAssignment(assignment: any) {
  const teacher = assignment?.teacher || {};
  const fullName = String(teacher?.fullName || '').trim();
  const email = String(teacher?.email || '').trim();
  const username = String(teacher?.username || '').trim();
  const code = String(teacher?.code || '').trim();
  const id = String(teacher?.id || '').trim();
  const roleShortName = String(assignment?.role?.shortName || '').trim();
  const roleName = String(assignment?.role?.name || '').trim();

  if (!fullName && !email && !username && !code && !id) return null;

  return {
    id,
    fullName,
    email,
    username,
    code,
    roleShortName,
    roleName,
  };
}

function uniqueTeacherAccounts(assignments: any[]) {
  const seen = new Set<string>();
  const accounts: Array<{
    id: string;
    fullName: string;
    email: string;
    username: string;
    code: string;
    roleShortName: string;
    roleName: string;
  }> = [];

  assignments.forEach((assignment) => {
    if (assignment?.isActive === false) return;
    const account = teacherAccountFromAssignment(assignment);
    if (!account) return;
    const key = account.id || account.email || account.username || account.code || account.fullName;
    if (seen.has(key)) return;
    seen.add(key);
    accounts.push(account);
  });

  return accounts;
}

function teacherDisplayName(
  account: { fullName: string; username: string; email: string; code: string },
): string {
  return account.fullName || account.username || account.email || account.code;
}

function userRolesForClass(cls: any, userEmail: string): string[] {
  const roles = new Set<string>();
  const slots = sortedSlots(cls);
  const session14 = slots[SESSION_COUNT - 1];
  const hasTeacherAssignment =
    (cls?.teachers || []).some((teacher: any) => teacherMatches(teacher, userEmail)) ||
    slots.some((slot: any) =>
      (slot?.teachers || []).some((teacher: any) => teacherMatches(teacher, userEmail)),
    );
  const hasAttendedSlot = slots.some((slot: any) => hasMatchingTeacherAttendance(slot, userEmail));

  if (
    (cls?.teachers || []).some((teacher: any) => isLecAssignment(teacher, userEmail)) ||
    slots.some((slot: any) =>
      (slot?.teachers || []).some((teacher: any) => isLecAssignment(teacher, userEmail)),
    )
  ) {
    roles.add('LEC');
  }

  if ((session14?.teachers || []).some((teacher: any) => isJudgeAssignment(teacher, userEmail))) {
    roles.add('JUDGE_SESSION_14');
  }

  if (hasTeacherAssignment && !roles.has('LEC') && !roles.has('JUDGE_SESSION_14')) {
    roles.add('ASSIGNED_TEACHER');
  }

  if (hasAttendedSlot) {
    roles.add('TEACHER_ATTENDANCE');
  }

  return Array.from(roles);
}

function hasTeacherAccessToClass(cls: any, userEmail: string): boolean {
  return userRolesForClass(cls, userEmail).length > 0;
}

function dateInputToIso(value: string | null, endOfDay: boolean): string {
  if (value) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`).toISOString();
  }

  const date = new Date();
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  date.setDate(date.getDate() + (endOfDay ? 365 : -365));
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

function slotTimestamp(slot: any): number | null {
  const time = new Date(slot?.startTime || slot?.date || 0).getTime();
  return Number.isFinite(time) && time > 0 ? time : null;
}

function progressSessionForClass(cls: any, slots: any[]): { progressSession: number; progressTotal: number } {
  const progressTotal = Number(cls?.numberOfSessions || SESSION_COUNT) || SESSION_COUNT;
  const datedSlots = slots
    .map((slot) => ({ slot, time: slotTimestamp(slot) }))
    .filter((entry): entry is { slot: any; time: number } => entry.time !== null)
    .sort((a, b) => a.time - b.time);

  if (datedSlots.length === 0) {
    return { progressSession: 0, progressTotal };
  }

  const status = normalizeStatus(cls?.status);
  if (status === 'FINISHED') {
    return {
      progressSession: Math.min(progressTotal, datedSlots.length || progressTotal),
      progressTotal,
    };
  }

  const now = Date.now();
  const firstFutureIndex = datedSlots.findIndex((entry) => entry.time > now);
  const currentSession =
    firstFutureIndex >= 0
      ? firstFutureIndex + 1
      : Math.min(progressTotal, datedSlots.length);

  return {
    progressSession: Math.min(progressTotal, Math.max(1, currentSession)),
    progressTotal,
  };
}

function mapStudent(studentRow: any) {
  const student = studentRow?.student || {};
  return {
    id: String(student.id || studentRow?._id || ''),
    fullName: String(student.fullName || '').trim() || 'Học viên',
    phoneNumber: student.phoneNumber || null,
    email: student.email || null,
    gender: student.gender || null,
    customer: student.customer || null,
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
      customer: student.customer || null,
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
    teachers: uniqueTeacherAccounts([
      ...(slot?.teachers || []),
      ...(slot?.teacherAttendance || []),
    ]),
    studentAttendance: attendances,
    recordedCount,
    studentsCount,
  };
}

function mapClass(cls: any, userEmail: string) {
  const students = (cls?.students || [])
    .filter((row: any) => row?.activeInClass !== false)
    .map(mapStudent)
    .filter((student: { id: string }) => Boolean(student.id))
    .sort((a: { fullName: string }, b: { fullName: string }) =>
      a.fullName.localeCompare(b.fullName, 'vi'),
    );

  const rawSortedSlots = sortedSlots(cls);
  const rawSlotTeacherAssignments = rawSortedSlots.flatMap((slot: any) => slot?.teachers || []);
  const rawSlotTeacherAttendance = rawSortedSlots.flatMap((slot: any) => slot?.teacherAttendance || []);
  const { progressSession, progressTotal } = progressSessionForClass(cls, rawSortedSlots);
  const slots = rawSortedSlots
    .slice(0, SESSION_COUNT)
    .map((slot: any, index: number) => mapSlot(slot, index, students.length));

  const classTeachers = uniqueTeacherAccounts(cls?.teachers || []);
  const slotTeachers = uniqueTeacherAccounts([
    ...rawSlotTeacherAssignments,
    ...rawSlotTeacherAttendance,
  ]);
  const allTeachers = uniqueTeacherAccounts([
    ...(cls?.teachers || []),
    ...rawSlotTeacherAssignments,
    ...rawSlotTeacherAttendance,
  ]);

  const lecTeachers = (cls?.teachers || [])
    .filter((teacher: any) => teacher?.isActive !== false)
    .filter((teacher: any) =>
      roleValues(teacher).some((role) => role === 'LEC' || role.includes('LECTURER')),
    )
    .map((teacher: any) => teacherDisplayName(teacherAccountFromAssignment(teacher) || {
      fullName: '',
      username: '',
      email: '',
      code: '',
    }))
    .filter(Boolean);

  const operator = cls?.operator || {};
  const operatorName = [
    operator?.firstName,
    operator?.middleName,
    operator?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || operator?.username || '';

  return {
    id: String(cls?.id || ''),
    name: String(cls?.name || '').trim() || 'Lớp học',
    status: normalizeStatus(cls?.status) || 'UNKNOWN',
    startDate: cls?.startDate || null,
    endDate: cls?.endDate || null,
    sessionCount: SESSION_COUNT,
    numberOfSessions: Number(cls?.numberOfSessions || SESSION_COUNT) || SESSION_COUNT,
    progressSession,
    progressTotal,
    operationMethodName: cls?.operationMethod?.name || '',
    operatorName,
    centreId: cls?.centre?.id || null,
    courseName: cls?.course?.name || '',
    courseShortName: cls?.course?.shortName || '',
    courseLineName: cls?.course?.courseLine?.name || '',
    centreName: cls?.centre?.name || '',
    centreShortName: cls?.centre?.shortName || cls?.centre?.name || '',
    classTeachers,
    slotTeachers,
    allTeachers,
    allTeacherNames: allTeachers.map(teacherDisplayName).filter(Boolean),
    lecTeachers: Array.from(new Set(lecTeachers)),
    accessRoles: userRolesForClass(cls, userEmail),
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
    const searchParam = request.nextUrl.searchParams.get('q')?.trim() || undefined;
    const statusParam = request.nextUrl.searchParams.get('status')?.trim().toUpperCase();
    const statusIn = statusParam && statusParam !== 'ALL' ? [statusParam] : undefined;
    const classIdParam = request.nextUrl.searchParams.get('classId')?.trim();
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
          search: searchParam,
          statusIn,
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
            search: searchParam,
            statusIn,
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
          .filter((cls: any) => !classIdParam || String(cls?.id || '') === classIdParam)
          .map((cls: any) => [String(cls.id), cls]),
      ).values(),
    );

    const classes = uniqueClasses
      .map((cls) => mapClass(cls, userEmail))
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
