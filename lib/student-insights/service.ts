import { callLmsApi } from '@/lib/lms-api';
import type { Class, StudentInsightSessionComment, StudentInsightAttendanceItem, StudentInsightLearningItem } from './types';

const GET_CLASSES_LIGHT_QUERY = /* graphql */ `
  query GetClassesLight(
    $search: String, $centre: String, $operationMethodId: [String],
    $openStatus: [String], $centres: [String], $courses: [String],
    $courseLines: [String], $startDateFrom: Date, $startDateTo: Date,
    $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date,
    $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String,
    $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String],
    $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!,
    $orderBy: String, $teacherId: String, $teacherSlot: [String],
    $passedSessionIndex: Int, $unpassedSessionIndex: Int,
    $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery
  ) {
    classes(payload: {
      filter_textSearch: $search, centre_equals: $centre, centre_in: $centres,
      operationMethodId_in: $operationMethodId, teacher_equals: $teacherId,
      teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines,
      startDate_gt: $startDateFrom, startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom, endDate_lt: $endDateTo,
      haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo,
      status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status,
      attendanceStatus_in: $attendanceStatus,
      studentAttendanceStatus_in: $studentAttendanceStatus,
      teacherAttendanceStatus_in: $teacherAttendanceStatus,
      attendanceChecked_exists: $attendanceCheckedExists,
      haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex,
      unpassedSessionIndex: $unpassedSessionIndex,
      pageIndex: $pageIndex, itemsPerPage: $itemsPerPage,
      orderBy: $orderBy, comments: $comments, openStatus: $openStatus
    }) {
      data {
        id
        name
        status
        startDate
        endDate
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        classStatusConfig {
          id
          code
          statusConfigs {
            id
            status
            nextStatuses
            description
            allowActions
          }
        }
        teachers {
          isActive
          teacher { id fullName }
          role { shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName }
          completionInfo {
            status
            reason
          }
        }
        slots {
          _id
          date
          teachers {
            isActive
            teacher { id fullName }
            role { shortName }
          }
          studentAttendance {
            student { id }
          }
        }
      }
      pagination { total }
    }
  }
`;

const GET_CLASSES_FULL_QUERY = /* graphql */ `
  query GetClasses(
    $search: String, $centre: String, $operationMethodId: [String],
    $openStatus: [String], $centres: [String], $courses: [String],
    $courseLines: [String], $startDateFrom: Date, $startDateTo: Date,
    $endDateFrom: Date, $endDateTo: Date, $haveSlotFrom: Date, $haveSlotTo: Date,
    $statusNotEquals: String, $attendanceCheckedExists: Boolean, $status: String,
    $statusIn: [String], $attendanceStatus: [String], $studentAttendanceStatus: [String],
    $teacherAttendanceStatus: [String], $pageIndex: Int!, $itemsPerPage: Int!,
    $orderBy: String, $teacherId: String, $teacherSlot: [String],
    $passedSessionIndex: Int, $unpassedSessionIndex: Int,
    $haveSlotIn: HaveSlotIn, $comments: ClassCommentQuery
  ) {
    classes(payload: {
      filter_textSearch: $search, centre_equals: $centre, centre_in: $centres,
      operationMethodId_in: $operationMethodId, teacher_equals: $teacherId,
      teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines,
      startDate_gt: $startDateFrom, startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom, endDate_lt: $endDateTo,
      haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo,
      status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status,
      attendanceStatus_in: $attendanceStatus,
      studentAttendanceStatus_in: $studentAttendanceStatus,
      teacherAttendanceStatus_in: $teacherAttendanceStatus,
      attendanceChecked_exists: $attendanceCheckedExists,
      haveSlot_in: $haveSlotIn, passedSessionIndex: $passedSessionIndex,
      unpassedSessionIndex: $unpassedSessionIndex,
      pageIndex: $pageIndex, itemsPerPage: $itemsPerPage,
      orderBy: $orderBy, comments: $comments, openStatus: $openStatus
    }) {
      data {
        id
        name
        level
        status
        startDate
        endDate
        numberOfSessions
        numberOfSessionsStatus
        sessionHour
        totalHour
        openingRoomNo
        hasSchedule
        createdAt
        lastModifiedAt
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        classSites { _id name }
        operationMethod { id name }
        operator { id username firstName middleName lastName }
        classStatusConfig {
          id
          code
          statusConfigs {
            id
            status
            nextStatuses
            description
            allowActions
          }
        }
        teachers {
          _id
          isActive
          teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName }
        }
        students {
          _id
          activeInClass
          createdAt
          note
          student {
            id
            fullName
            customer { fullName phoneNumber email facebook zalo }
          }
          completionInfo {
            status
            note
            reason
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
            teacher { id username code fullName email phoneNumber imageUrl }
            role { id name shortName }
          }
          teacherAttendance {
            _id status note createdAt lastModifiedAt
            teacher { id fullName email }
          }
          studentAttendance {
            _id status comment sendCommentStatus
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
        courseProcess {
          id
          defaultCommentAreas {
            id name type isRequired guideline
            rates { value commentSamples }
          }
          specificSessions {
            session
            commentAreas {
              id name type isRequired guideline
              rates { value commentSamples }
            }
          }
          finalSession {
            finalEvaluations {
              id title
              commentAreas {
                id name type isRequired guideline
                rates { value commentSamples }
              }
            }
            demoScore {
              commentAreas {
                id name type
                demo { id title maxScore }
              }
            }
          }
          checkpointSessions {
            session
            checkpointCommentArea {
              id name type
            }
            otherComments {
              id name type isRequired guideline
              rates { value commentSamples }
            }
            evaluations {
              id title
              commentAreas {
                id name type isRequired guideline
                rates { value commentSamples }
              }
            }
          }
        }
      }
      pagination { type total }
    }
  }
`;

const DEFAULT_CENTRE_IDS = [
  '62918d02af37d11e2da237e5',
  '63034f4a7d1d1e1cb14e4e57',
  '62cc07753c1309654f472e60',
  '62d6dcc16e356729147d73a6',
  '62b0234675379306da49f051',
  '609bf4149535070ca5e3edc0',
  '62d6dc936e356729147d7399',
];

const LMS_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

function lmsLocalDateToUtcIso(value: string, endOfDay = false): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    const fallback = new Date(value);
    if (endOfDay) fallback.setHours(23, 59, 59, 999);
    else fallback.setHours(0, 0, 0, 0);
    return new Date(fallback.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();
  }
  const utcMs = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(utcMs - LMS_TIMEZONE_OFFSET_MS).toISOString();
}

function haveSlotInToUtcRange(fromDate: Date, toDate: Date): { from: string; to: string } {
  const startLocal = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0);
  const from = new Date(startLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();
  const endLocal = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
  const to = new Date(endLocal.getTime() - LMS_TIMEZONE_OFFSET_MS).toISOString();
  return { from, to };
}

async function fetchPendingSurveyClasses(
  fromDate: Date,
  toDate: Date,
  teacherLmsId?: string,
  authHeader?: string,
  onProgress?: (loaded: number, total: number, chunk: Class[]) => void,
  signal?: AbortSignal
): Promise<Class[]> {
  const haveSlotIn = haveSlotInToUtcRange(fromDate, toDate);
  const allClasses: Class[] = [];
  const base = {
    haveSlotIn,
    ...(teacherLmsId ? { teacherSlot: [teacherLmsId] } : { centres: DEFAULT_CENTRE_IDS }),
    pageIndex: 0,
    itemsPerPage: 100,
    orderBy: 'createdAt_desc',
  };

  const response = await callLmsApi<{ data: { classes: { data: Class[]; pagination: { total: number } } } }>({
    query: GET_CLASSES_FULL_QUERY,
    operationName: 'GetClasses',
    variables: base,
  }, authHeader);

  const firstPage = response.data.classes;
  allClasses.push(...firstPage.data);
  onProgress?.(allClasses.length, firstPage.pagination.total, firstPage.data);

  if (firstPage.pagination.total > allClasses.length) {
    const totalPages = Math.ceil(firstPage.pagination.total / 100);
    const promises = [];
    for (let i = 1; i < totalPages; i++) {
      promises.push(
        callLmsApi<{ data: { classes: { data: Class[]; pagination: { total: number } } } }>({
          query: GET_CLASSES_FULL_QUERY,
          operationName: 'GetClasses',
          variables: { ...base, pageIndex: i },
        }, authHeader)
      );
    }
    const responses = await Promise.all(promises);
    for (const res of responses) {
      allClasses.push(...res.data.classes.data);
    }
  }

  return allClasses;
}
function sortSlotsByDate(cls: Class) {
  return (cls.slots ?? [])
    .filter(s => !!s.date)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildTeacherNames(slot: Class['slots'][number]): string[] {
  const names = new Set<string>();
  (slot.teacherAttendance ?? []).forEach(ta => {
    if (ta.teacher?.fullName) names.add(ta.teacher.fullName);
  });
  (slot.teachers ?? []).forEach(t => {
    if (t.teacher?.fullName) names.add(t.teacher.fullName);
  });
  return Array.from(names);
}

function getStudentAttendanceInSlot(slot: Class['slots'][number], studentId: string) {
  return (slot.studentAttendance ?? []).find(sa => sa.student?.id === studentId);
}

async function fetchStudentClassesInRange(
  studentId: string,
  fromDate: Date,
  toDate: Date,
  classId?: string,
  teacherLmsId?: string,
  authHeader?: string
): Promise<Class[]> {
  const classes = await fetchPendingSurveyClasses(fromDate, toDate, teacherLmsId, authHeader, undefined, undefined);
  const filtered: Class[] = [];

  for (const cls of classes) {
    if (classId && cls.id !== classId) continue;
    const hasStudent = (cls.slots ?? []).some(slot =>
      (slot.studentAttendance ?? []).some(sa => sa.student?.id === studentId)
    );
    if (hasStudent) filtered.push(cls);
  }

  return filtered;
}

export async function getStudentComments(
  studentId: string,
  fromDate: Date,
  toDate: Date,
  classId?: string,
  teacherLmsId?: string,
  authHeader?: string
): Promise<StudentInsightSessionComment[]> {
  const classes = await fetchStudentClassesInRange(studentId, fromDate, toDate, classId, teacherLmsId, authHeader);
  const results: StudentInsightSessionComment[] = [];

  for (const cls of classes) {
    const slots = sortSlotsByDate(cls);
    slots.forEach((slot, idx) => {
      const sa = getStudentAttendanceInSlot(slot, studentId);
      if (!sa) return;
      results.push({
        classId: cls.id,
        className: cls.name,
        centreId: cls.centre?.id,
        centreName: cls.centre?.name,
        courseId: cls.course?.id,
        courseName: cls.course?.name,
        slotId: slot._id,
        slotDate: slot.date,
        sessionIndex: idx + 1,
        attendanceStatus: sa.status ?? 'UNKNOWN',
        sendCommentStatus: sa.sendCommentStatus ?? 'UNKNOWN',
        commentText: sa.comment ?? '',
        commentByAreas: sa.commentByAreas,
        teacherNames: buildTeacherNames(slot),
      });
    });
  }

  results.sort((a, b) => new Date(a.slotDate).getTime() - new Date(b.slotDate).getTime());
  return results;
}

export async function getStudentAttendance(
  studentId: string,
  fromDate: Date,
  toDate: Date,
  classId?: string,
  teacherLmsId?: string,
  authHeader?: string
): Promise<StudentInsightAttendanceItem[]> {
  const classes = await fetchStudentClassesInRange(studentId, fromDate, toDate, classId, teacherLmsId, authHeader);
  const results: StudentInsightAttendanceItem[] = [];

  for (const cls of classes) {
    const slots = sortSlotsByDate(cls);
    slots.forEach((slot, idx) => {
      const sa = getStudentAttendanceInSlot(slot, studentId);
      if (!sa) return;
      results.push({
        classId: cls.id,
        className: cls.name,
        slotId: slot._id,
        slotDate: slot.date,
        sessionIndex: idx + 1,
        status: sa.status ?? 'UNKNOWN',
      });
    });
  }

  results.sort((a, b) => new Date(a.slotDate).getTime() - new Date(b.slotDate).getTime());
  return results;
}

export async function getStudentLearningProgress(
  studentId: string,
  fromDate: Date,
  toDate: Date,
  classId?: string,
  teacherLmsId?: string,
  authHeader?: string
): Promise<StudentInsightLearningItem[]> {
  const classes = await fetchStudentClassesInRange(studentId, fromDate, toDate, classId, teacherLmsId, authHeader);
  const results: StudentInsightLearningItem[] = [];

  for (const cls of classes) {
    const slots = sortSlotsByDate(cls);
    slots.forEach((slot, idx) => {
      const sa = getStudentAttendanceInSlot(slot, studentId);
      if (!sa) return;
      results.push({
        classId: cls.id,
        className: cls.name,
        slotId: slot._id,
        slotDate: slot.date,
        sessionIndex: idx + 1,
        summary: slot.summary ?? undefined,
        homework: slot.homework ?? undefined,
      });
    });
  }

  results.sort((a, b) => new Date(a.slotDate).getTime() - new Date(b.slotDate).getTime());
  return results;
}
