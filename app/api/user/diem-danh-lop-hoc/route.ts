import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import { getOrRefreshLmsToken, applyRefreshedCookies, LmsTokenSession } from '@/lib/lms-token-helper';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COUNT = 14;
const ITEMS_PER_PAGE = 200;
const MAX_PAGES = 30;
const WRITE_TIMEOUT_MS = 12_000;
const LMS_API_URL = process.env.LMS_API_URL || 'https://lms-api.mindx.edu.vn/';
const inFlightWrites = new Set<string>();

const TEACHER_ASSIGNMENT_FIELDS = /* graphql */ `
  _id
  isActive
  teacher { id user fullName username code email imageUrl }
  role { id name shortName }
`;

const ATTENDANCE_CLASS_FIELDS = /* graphql */ `
  id
  name
  status
  startDate
  endDate
  numberOfSessions
  operationMethod { id name }
  operator { id email username displayName firstName middleName lastName }
  course { id name shortName courseLine { id name } }
  centre { id name shortName }
  teachers { ${TEACHER_ASSIGNMENT_FIELDS} }
  students {
    _id
    note
    activeInClass
    createdAt
    classSite { _id name }
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
  classSites {
    _id
    name
    operator { id email username displayName firstName middleName lastName }
    teachers { ${TEACHER_ASSIGNMENT_FIELDS} }
    classSiteSlots {
      classSlotId
      teachers { ${TEACHER_ASSIGNMENT_FIELDS} }
    }
  }
  slots {
    _id
    index
    date
    startTime
    endTime
    sessionHour
    summary
    homework
    teachers { ${TEACHER_ASSIGNMENT_FIELDS} }
    teacherAttendance {
      _id
      status
      note
      teacher { id user fullName username code email imageUrl }
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
`;

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
      orderBy: "startDate_desc"
    }) {
      pagination { total }
      data { ${ATTENDANCE_CLASS_FIELDS} }
    }
  }
`;

const GET_ATTENDANCE_CLASS_BY_ID_QUERY = /* graphql */ `
  query GetAttendanceClassById($id: ID!) {
    classesById(id: $id) { ${ATTENDANCE_CLASS_FIELDS} }
  }
`;

const UPDATE_SLOT_ATTENDANCE_MUTATION = /* graphql */ `
  mutation UpdateSlotAttendance($payload: SlotAttendanceCommand!) {
    classes {
      updateSlotAttendance(payload: $payload) { id }
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

function isTaAssignment(assignment: any, userEmail: string): boolean {
  if (!teacherMatches(assignment, userEmail)) return false;

  return roleValues(assignment).some(
    (role) =>
      role === 'TA' ||
      role === 'TG' ||
      role === 'TUTOR' ||
      role.includes('TRO GIANG') ||
      role.includes('TEACHING ASSISTANT') ||
      role.includes('ASSISTANT') ||
      role.includes('SUPPORTER'),
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
  const classSiteAssignments = (cls?.classSites || []).flatMap((classSite: any) => [
    ...(classSite?.teachers || []),
    ...(classSite?.classSiteSlots || []).flatMap((slot: any) => slot?.teachers || []),
  ]);
  const assignments = [
    ...(cls?.teachers || []),
    ...slots.flatMap((slot: any) => slot?.teachers || []),
    ...classSiteAssignments,
  ];
  const hasTeacherAssignment = assignments.some((teacher: any) =>
    teacherMatches(teacher, userEmail),
  );
  const hasAttendedSlot = slots.some((slot: any) => hasMatchingTeacherAttendance(slot, userEmail));

  if (assignments.some((teacher: any) => isLecAssignment(teacher, userEmail))) {
    roles.add('LEC');
  }

  if (assignments.some((teacher: any) => isTaAssignment(teacher, userEmail))) {
    roles.add('TA');
  }

  if (assignments.some((teacher: any) => isJudgeAssignment(teacher, userEmail))) {
    roles.add('JUDGE');
  }

  if ((session14?.teachers || []).some((teacher: any) => isJudgeAssignment(teacher, userEmail))) {
    roles.add('JUDGE_SESSION_14');
  }

  if (hasTeacherAssignment && !roles.has('LEC') && !roles.has('TA') && !roles.has('JUDGE')) {
    roles.add('ASSIGNED_TEACHER');
  }

  if (hasAttendedSlot) {
    roles.add('TEACHER_ATTENDANCE');
  }

  return Array.from(roles);
}

function dateInputToIso(value: string | null, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`).toISOString();
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
  const startedSessionCount = datedSlots.filter((entry) => entry.time <= now).length;

  return {
    progressSession: Math.min(progressTotal, startedSessionCount),
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
    classSiteId: String(studentRow?.classSite?._id || ''),
    classSiteName: String(studentRow?.classSite?.name || ''),
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

function mapClass(cls: any, userEmail: string, isSuperAdmin = false) {
  const students = (cls?.students || [])
    .filter((row: any) => row?.activeInClass !== false)
    .map(mapStudent)
    .filter((student: { id: string }) => Boolean(student.id))
    .sort((a: { fullName: string }, b: { fullName: string }) =>
      a.fullName.localeCompare(b.fullName, 'vi'),
    );

  const rawSortedSlots = sortedSlots(cls);
  const rawClassSites = Array.isArray(cls?.classSites) ? cls.classSites : [];
  const rawClassSiteTeachers = rawClassSites.flatMap((classSite: any) => classSite?.teachers || []);
  const rawClassSiteSlotTeachers = rawClassSites.flatMap((classSite: any) =>
    (classSite?.classSiteSlots || []).flatMap((slot: any) => slot?.teachers || []),
  );
  const classSiteTeachersBySlot = new Map<string, any[]>();
  rawClassSites.forEach((classSite: any) => {
    (classSite?.classSiteSlots || []).forEach((classSiteSlot: any) => {
      const slotId = String(classSiteSlot?.classSlotId || '');
      if (!slotId) return;
      classSiteTeachersBySlot.set(slotId, [
        ...(classSiteTeachersBySlot.get(slotId) || []),
        ...(classSiteSlot?.teachers || []),
      ]);
    });
  });
  const rawSlotTeacherAssignments = rawSortedSlots.flatMap((slot: any) => slot?.teachers || []);
  const rawSlotTeacherAttendance = rawSortedSlots.flatMap((slot: any) => slot?.teacherAttendance || []);
  const { progressSession, progressTotal } = progressSessionForClass(cls, rawSortedSlots);
  const numberOfSessions = Number(cls?.numberOfSessions || rawSortedSlots.length || SESSION_COUNT) || SESSION_COUNT;
  const slots = rawSortedSlots
    .slice(0, numberOfSessions)
    .map((slot: any, index: number) => mapSlot({
      ...slot,
      teachers: [
        ...(slot?.teachers || []),
        ...(classSiteTeachersBySlot.get(String(slot?._id || '')) || []),
      ],
    }, index, students.length));

  const classTeachers = uniqueTeacherAccounts(cls?.teachers || []);
  const slotTeachers = uniqueTeacherAccounts([
    ...rawSlotTeacherAssignments,
    ...rawSlotTeacherAttendance,
  ]);
  const allTeachers = uniqueTeacherAccounts([
    ...(cls?.teachers || []),
    ...rawSlotTeacherAssignments,
    ...rawSlotTeacherAttendance,
    ...rawClassSiteTeachers,
    ...rawClassSiteSlotTeachers,
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
  const operatorName = String(operator?.displayName || '').trim() || [
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
    sessionCount: numberOfSessions,
    numberOfSessions,
    progressSession,
    progressTotal,
    operationMethodName: cls?.operationMethod?.name || '',
    operatorName,
    centreId: cls?.centre?.id || null,
    courseId: cls?.course?.id || null,
    courseName: cls?.course?.name || '',
    courseShortName: cls?.course?.shortName || '',
    courseLineName: cls?.course?.courseLine?.name || '',
    centreName: cls?.centre?.name || '',
    centreShortName: cls?.centre?.shortName || cls?.centre?.name || '',
    classSites: rawClassSites
      .map((classSite: any) => ({
        id: String(classSite?._id || ''),
        name: String(classSite?.name || '').trim() || 'Default',
        slotTeacherIds: Object.fromEntries(
          (classSite?.classSiteSlots || []).map((classSiteSlot: any) => [
            String(classSiteSlot?.classSlotId || ''),
            uniqueAssignments(classSiteSlot?.teachers || [])
              .map((assignment) => String(assignment?.teacher?.id || ''))
              .filter(Boolean),
          ]).filter(([slotId]: [string, string[]]) => Boolean(slotId)),
        ),
      }))
      .filter((classSite: { id: string }) => Boolean(classSite.id)),
    classTeachers,
    slotTeachers,
    allTeachers,
    allTeacherNames: allTeachers.map(teacherDisplayName).filter(Boolean),
    lecTeachers: Array.from(new Set(lecTeachers)),
    accessRoles: isSuperAdmin
      ? Array.from(new Set(['MANAGER', 'SUPER_ADMIN', ...userRolesForClass(cls, userEmail)]))
      : userRolesForClass(cls, userEmail),
    students,
    slots,
  };
}

function getClassRecencyScore(cls: any, todayMs: number): number {
  const slotDates: number[] = [];
  if (Array.isArray(cls.slots)) {
    for (const slot of cls.slots) {
      if (slot.isPlaceholder) continue;
      const rawDate = slot.date || slot.startTime;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          slotDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
        }
      }
    }
  }

  if (slotDates.length === 0) {
    if (cls.startDate) {
      const d = new Date(cls.startDate);
      if (!isNaN(d.getTime())) {
        slotDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
      }
    }
    if (cls.endDate) {
      const d = new Date(cls.endDate);
      if (!isNaN(d.getTime())) {
        slotDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
      }
    }
  }

  if (slotDates.length === 0) {
    return 999999999;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;

  // 1. Kiểm tra nếu có slot đúng hôm nay (chênh lệch < 12h so với 00:00 hôm nay)
  const hasToday = slotDates.some((time) => Math.abs(time - todayMs) < 12 * 60 * 60 * 1000);
  if (hasToday) {
    return 0; // Ưu tiên cao nhất
  }

  // 2. Tìm slot tương lai gần nhất (>= todayMs)
  const futureSlots = slotDates.filter((time) => time >= todayMs).sort((a, b) => a - b);
  const nextFutureSlot = futureSlots.length > 0 ? futureSlots[0] : null;

  // 3. Tìm slot quá khứ gần nhất (< todayMs)
  const pastSlots = slotDates.filter((time) => time < todayMs).sort((a, b) => b - a);
  const lastPastSlot = pastSlots.length > 0 ? pastSlots[0] : null;

  if (nextFutureSlot !== null && lastPastSlot !== null) {
    const futureDiffDays = (nextFutureSlot - todayMs) / oneDayMs;
    const pastDiffDays = (todayMs - lastPastSlot) / oneDayMs;
    if (futureDiffDays <= pastDiffDays) {
      return futureDiffDays;
    } else {
      return pastDiffDays + 0.05;
    }
  } else if (nextFutureSlot !== null) {
    return (nextFutureSlot - todayMs) / oneDayMs;
  } else if (lastPastSlot !== null) {
    return (todayMs - lastPastSlot) / oneDayMs + 0.05;
  }

  return 999999999;
}

function compareClassesByRecency(a: any, b: any, todayMs: number): number {
  const scoreA = getClassRecencyScore(a, todayMs);
  const scoreB = getClassRecencyScore(b, todayMs);

  if (Math.abs(scoreA - scoreB) > 0.001) {
    return scoreA - scoreB;
  }

  if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
  if (b.status === 'RUNNING' && a.status !== 'RUNNING') return 1;

  return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
}

type SubmittedAttendance = {
  personId: string;
  status: string;
  note?: string;
};

type SaveAttendanceBody = {
  classId?: unknown;
  classSiteId?: unknown;
  slotId?: unknown;
  expectedStartTime?: unknown;
  students?: unknown;
  teachers?: unknown;
};

class LmsRequestError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly ambiguous = false,
  ) {
    super(message);
    this.name = 'LmsRequestError';
  }
}

function safeIdentifier(value: unknown): string {
  const text = String(value ?? '').trim();
  return /^[a-zA-Z0-9_-]{1,128}$/.test(text) ? text : '';
}

function parseSubmittedAttendance(value: unknown): SubmittedAttendance[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;

  const parsed: SubmittedAttendance[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const personId = safeIdentifier(row.personId);
    const status = normalizeStatus(row.status);
    const note = String(row.note ?? '').trim().slice(0, 1_000);
    if (!personId || !['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].includes(status) || seen.has(personId)) {
      return null;
    }
    seen.add(personId);
    parsed.push({ personId, status, ...(note ? { note } : {}) });
  }
  return parsed;
}

function toLmsAttendanceStatus(status: string): string {
  if (status === 'PRESENT') return 'ATTENDED';
  if (status === 'LATE') return 'LATE_ARRIVED';
  if (status === 'EXCUSED') return 'ABSENT_WITH_NOTICE';
  return 'ABSENT';
}

function sameInstant(a: unknown, b: unknown): boolean {
  if (!a || !b) return true;
  const left = new Date(String(a)).getTime();
  const right = new Date(String(b)).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1_000;
}

function uniqueAssignments(assignments: any[]): any[] {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (assignment?.isActive === false) return false;
    const id = String(assignment?.teacher?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function assignmentsForSlot(cls: any, classSite: any, slot: any): any[] {
  const classSiteSlot = (classSite?.classSiteSlots || []).find(
    (item: any) => String(item?.classSlotId || '') === String(slot?._id || ''),
  );
  if (classSiteSlot) return uniqueAssignments(classSiteSlot?.teachers || []);
  return uniqueAssignments(slot?.teachers || []);
}

function studentsForClassSite(cls: any, classSiteId: string): any[] {
  const classSiteCount = Array.isArray(cls?.classSites) ? cls.classSites.length : 0;
  return (cls?.students || []).filter((row: any) => {
    if (row?.activeInClass === false) return false;
    const rowClassSiteId = String(row?.classSite?._id || '');
    return rowClassSiteId === classSiteId || (!rowClassSiteId && classSiteCount <= 1);
  });
}

function attendanceMatches(
  cls: any,
  slotId: string,
  students: SubmittedAttendance[],
  teachers: SubmittedAttendance[],
): boolean {
  const slot = (cls?.slots || []).find((item: any) => String(item?._id || '') === slotId);
  if (!slot) return false;

  const studentStatuses = new Map(
    (slot?.studentAttendance || []).map((row: any) => [
      String(row?.student?.id || ''),
      normalizeStatus(row?.status),
    ]),
  );
  const teacherStatuses = new Map(
    (slot?.teacherAttendance || []).map((row: any) => [
      String(row?.teacher?.id || ''),
      normalizeStatus(row?.status),
    ]),
  );

  return students.every(
    (row) => studentStatuses.get(row.personId) === toLmsAttendanceStatus(row.status),
  ) && teachers.every(
    (row) => teacherStatuses.get(row.personId) === toLmsAttendanceStatus(row.status),
  );
}

async function callLmsOnce<T>(
  request: { query: string; variables?: Record<string, unknown>; operationName?: string },
  authHeader: string,
  timeoutMs = WRITE_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(LMS_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'X-API-KEY': process.env.LMS_API_KEY || '',
      },
      body: JSON.stringify(request),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => null) as {
      data?: unknown;
      errors?: Array<{ message?: string }>;
    } | null;

    if (!response.ok) {
      throw new LmsRequestError(
        response.status === 429
          ? 'LMS đang giới hạn tần suất. TPS chưa gửi lại để tránh ghi trùng.'
          : `LMS từ chối yêu cầu lưu (HTTP ${response.status}).`,
        response.status === 429 ? 429 : 502,
      );
    }
    if (!result) throw new LmsRequestError('LMS trả về dữ liệu không hợp lệ.');
    if (result.errors?.length) {
      const message = result.errors.map((error) => error.message).filter(Boolean).join('; ');
      throw new LmsRequestError(message || 'LMS không chấp nhận dữ liệu điểm danh.');
    }
    return result as T;
  } catch (error: unknown) {
    if (error instanceof LmsRequestError) throw error;
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    throw new LmsRequestError(
      isTimeout
        ? 'LMS phản hồi quá thời gian. TPS không tự gửi lại để tránh ghi trùng.'
        : 'Mất kết nối khi ghi LMS. TPS không tự gửi lại để tránh ghi trùng.',
      502,
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAttendanceClassById(classId: string, authHeader: string): Promise<any> {
  const result = await callLmsOnce<any>({
    query: GET_ATTENDANCE_CLASS_BY_ID_QUERY,
    operationName: 'GetAttendanceClassById',
    variables: { id: classId },
  }, authHeader);
  return result?.data?.classesById || null;
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const isSuperAdmin = auth.privileged || auth.resolvedAccess?.role === 'super_admin';
  const userEmail = normalizeEmail(auth.sessionEmail);

  let tokenSession: LmsTokenSession | null = null;
  let firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';

  if (isSuperAdmin) {
    // Tài khoản Super Admin tự động dùng tài khoản LMS fallback trong .env (LMS_FALLBACK_EMAIL, LMS_FALLBACK_PASSWORD)
    tokenSession = await getOrRefreshLmsToken(request);
    firebaseToken = tokenSession.token || firebaseToken;
  } else if (!firebaseToken) {
    tokenSession = await getOrRefreshLmsToken(request);
    if (!tokenSession.isFallback && tokenSession.token) {
      firebaseToken = tokenSession.token;
    }
  }

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
    const statusIn = statusParam && statusParam !== 'ALL' && statusParam !== 'TAT_CA'
      ? [statusParam]
      : ['RUNNING', 'FINISHED', 'PREPARING'];
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

    const maxPagesToFetch = isSuperAdmin && !searchParam && !classIdParam ? 10 : MAX_PAGES;

    for (let pageIndex = 1; pageIndex < totalPages && pageIndex < maxPagesToFetch; pageIndex++) {
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

    const ALLOWED_STATUSES = new Set(['RUNNING', 'FINISHED', 'PREPARING']);
    const uniqueClasses = Array.from(
      new Map(
        allClasses
          .filter((cls: any) => ALLOWED_STATUSES.has(normalizeStatus(cls?.status)))
          .filter((cls: any) => isSuperAdmin || hasTeacherAccessToClass(cls, userEmail))
          .filter((cls: any) => !classIdParam || String(cls?.id || '') === classIdParam)
          .map((cls: any) => [String(cls.id), cls]),
      ).values(),
    );

    const nowVn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const todayMs = new Date(nowVn.getFullYear(), nowVn.getMonth(), nowVn.getDate()).getTime();

    const classes = uniqueClasses
      .map((cls) => mapClass(cls, userEmail, isSuperAdmin))
      .filter((cls) => cls.id)
      .sort((a, b) => compareClassesByRecency(a, b, todayMs));

    const response = NextResponse.json({
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

    if (tokenSession) {
      applyRefreshedCookies(response, tokenSession);
    }

    return response;
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

export async function POST(request: NextRequest) {
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 64 * 1024) {
    return NextResponse.json({ success: false, message: 'Dữ liệu điểm danh quá lớn.' }, { status: 413 });
  }

  const firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';
  if (!firebaseToken) {
    return NextResponse.json(
      { success: false, noLmsToken: true, message: 'Phiên TPS chưa có token LMS cá nhân.' },
      { status: 401 },
    );
  }

  let body: SaveAttendanceBody;
  try {
    body = await request.json() as SaveAttendanceBody;
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const classId = safeIdentifier(body.classId);
  const classSiteId = safeIdentifier(body.classSiteId);
  const slotId = safeIdentifier(body.slotId);
  const expectedStartTime = String(body.expectedStartTime ?? '').trim();
  const students = parseSubmittedAttendance(body.students);
  const teachers = parseSubmittedAttendance(body.teachers);

  if (!classId || !classSiteId || !slotId || !students || !teachers) {
    return NextResponse.json(
      { success: false, message: 'Thiếu hoặc sai định dạng dữ liệu điểm danh.' },
      { status: 400 },
    );
  }

  const writeKey = `${classId}:${classSiteId}:${slotId}`;
  if (inFlightWrites.has(writeKey)) {
    return NextResponse.json(
      { success: false, message: 'Buổi học này đang được lưu. Vui lòng chờ kết quả hiện tại.' },
      { status: 409 },
    );
  }

  inFlightWrites.add(writeKey);
  const authHeader = `Bearer ${firebaseToken}`;
  const userEmail = normalizeEmail(auth.sessionEmail);

  try {
    const freshClass = await fetchAttendanceClassById(classId, authHeader);
    if (!freshClass || String(freshClass.id || '') !== classId) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy lớp trên LMS.' }, { status: 404 });
    }
    if (normalizeStatus(freshClass.status) !== 'RUNNING') {
      return NextResponse.json(
        { success: false, message: 'Chỉ có thể điểm danh lớp đang Running.' },
        { status: 409 },
      );
    }

    const classSite = (freshClass.classSites || []).find(
      (item: any) => String(item?._id || '') === classSiteId,
    );
    const slot = (freshClass.slots || []).find(
      (item: any) => String(item?._id || '') === slotId,
    );
    if (!classSite || !slot) {
      return NextResponse.json(
        { success: false, message: 'Lớp, class site hoặc buổi học đã thay đổi trên LMS. Hãy tải lại.' },
        { status: 409 },
      );
    }
    if (!sameInstant(expectedStartTime, slot.startTime)) {
      return NextResponse.json(
        { success: false, message: 'Giờ học đã thay đổi trên LMS. Hãy tải lại trước khi điểm danh.' },
        { status: 409 },
      );
    }

    const startTime = new Date(slot.startTime || slot.date || '').getTime();
    if (!Number.isFinite(startTime) || Date.now() < startTime) {
      return NextResponse.json(
        { success: false, message: 'Buổi học chưa bắt đầu nên chưa thể mở điểm danh.' },
        { status: 409 },
      );
    }

    const slotAssignments = assignmentsForSlot(freshClass, classSite, slot);
    const userTeacherAssignments = slotAssignments.filter(
      (assignment) => normalizeEmail(assignment?.teacher?.email) === userEmail,
    );
    const isOperator = [freshClass?.operator, classSite?.operator].some(
      (operator) => normalizeEmail(operator?.email) === userEmail,
    );
    if (!isOperator && userTeacherAssignments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Bạn không được phân công ở buổi học hoặc class site này.' },
        { status: 403 },
      );
    }

    const activeStudentRows = studentsForClassSite(freshClass, classSiteId);
    const activeStudentIds = new Set(
      activeStudentRows.map((row) => String(row?.student?.id || '')).filter(Boolean),
    );
    if (
      activeStudentIds.size === 0 ||
      students.length !== activeStudentIds.size ||
      students.some((row) => !activeStudentIds.has(row.personId))
    ) {
      return NextResponse.json(
        { success: false, message: 'Cần ghi nhận đầy đủ học viên đang học trong class site này.' },
        { status: 400 },
      );
    }

    const currentTeacherIds = new Set(
      userTeacherAssignments.map((assignment) => String(assignment?.teacher?.id || '')).filter(Boolean),
    );
    if (teachers.some((row) => currentTeacherIds.has(row.personId))) {
      return NextResponse.json(
        { success: false, message: 'Giáo viên không thể tự điểm danh cho chính mình.' },
        { status: 400 },
      );
    }

    const requiredTeacherIds = new Set(
      slotAssignments
        .map((assignment) => String(assignment?.teacher?.id || ''))
        .filter((id) => id && !currentTeacherIds.has(id)),
    );
    if (
      teachers.length !== requiredTeacherIds.size ||
      teachers.some((row) => !requiredTeacherIds.has(row.personId))
    ) {
      return NextResponse.json(
        { success: false, message: 'Cần ghi nhận đầy đủ giáo viên còn lại của buổi học.' },
        { status: 400 },
      );
    }

    if (attendanceMatches(freshClass, slotId, students, teachers)) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        message: 'Dữ liệu trên LMS đã trùng với nội dung điểm danh.',
        class: mapClass(freshClass, userEmail),
      });
    }

    const payload = {
      classId,
      classSiteId,
      slotId,
      studentAttendance: students.map((row) => ({
        student: row.personId,
        status: toLmsAttendanceStatus(row.status),
      })),
      teacherAttendance: teachers.map((row) => ({
        teacher: row.personId,
        status: toLmsAttendanceStatus(row.status),
        note: row.note || '',
      })),
    };

    let mutationError: LmsRequestError | null = null;
    try {
      await callLmsOnce({
        query: UPDATE_SLOT_ATTENDANCE_MUTATION,
        operationName: 'UpdateSlotAttendance',
        variables: { payload },
      }, authHeader);
    } catch (error: unknown) {
      mutationError = error instanceof LmsRequestError
        ? error
        : new LmsRequestError('Không thể ghi điểm danh lên LMS.', 502, true);
    }

    let verifiedClass: any = null;
    try {
      verifiedClass = await fetchAttendanceClassById(classId, authHeader);
    } catch (readbackError: unknown) {
      console.error('[diem-danh-lop-hoc] LMS readback failed:', readbackError);
    }

    if (verifiedClass && attendanceMatches(verifiedClass, slotId, students, teachers)) {
      return NextResponse.json({
        success: true,
        verified: true,
        message: mutationError
          ? 'LMS phản hồi không rõ ràng nhưng TPS đã đọc lại và xác nhận dữ liệu được lưu.'
          : 'Đã lưu và xác nhận dữ liệu điểm danh trên LMS.',
        class: mapClass(verifiedClass, userEmail),
      });
    }

    return NextResponse.json(
      {
        success: false,
        ambiguous: Boolean(mutationError?.ambiguous),
        message: mutationError?.message || 'LMS chưa xác nhận dữ liệu. TPS không tự gửi lại để tránh ghi trùng.',
      },
      { status: mutationError?.status || 502 },
    );
  } catch (error: unknown) {
    console.error('[diem-danh-lop-hoc] Save error:', error);
    const message = error instanceof Error ? error.message : 'Không thể lưu điểm danh lên LMS.';
    return NextResponse.json({ success: false, message }, { status: 502 });
  } finally {
    inFlightWrites.delete(writeKey);
  }
}
