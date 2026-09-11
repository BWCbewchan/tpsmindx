import { callLmsApi } from '@/lib/lms-api';
import pool from '@/lib/db';
import type { Class } from '@/lib/student-insights/types';
import type {
  PortfolioQCClass,
  PortfolioQCStudent,
  PortfolioQCFilter,
} from './types';

// ============================================================
// LMS GraphQL Query — lighter version for QC listing
// ============================================================

const GET_CLASSES_QC_QUERY = /* graphql */ `
  query GetClasses(
    $search: String, $centre: String,
    $centres: [String], $courses: [String],
    $courseLines: [String], $startDateFrom: Date, $startDateTo: Date,
    $endDateFrom: Date, $endDateTo: Date,
    $haveSlotFrom: Date, $haveSlotTo: Date,
    $statusNotEquals: String, $status: String,
    $statusIn: [String],
    $pageIndex: Int!, $itemsPerPage: Int!,
    $orderBy: String, $teacherId: String,
    $teacherSlot: [String],
    $haveSlotIn: HaveSlotIn
  ) {
    classes(payload: {
      filter_textSearch: $search, centre_equals: $centre, centre_in: $centres,
      teacher_equals: $teacherId,
      teacherSlots: $teacherSlot, course_in: $courses, courseLine_in: $courseLines,
      startDate_gt: $startDateFrom, startDate_lt: $startDateTo,
      endDate_gt: $endDateFrom, endDate_lt: $endDateTo,
      haveSlot_from: $haveSlotFrom, haveSlot_to: $haveSlotTo,
      status_ne: $statusNotEquals, status_in: $statusIn, status_equals: $status,
      haveSlot_in: $haveSlotIn,
      pageIndex: $pageIndex, itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      data {
        id
        name
        status
        startDate
        endDate
        course { id name shortName courseLine { id name } }
        centre { id name shortName }
        teachers {
          isActive
          teacher { id fullName }
          role { shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName }
        }
        numberOfSessions
        slots {
          _id
          date
          startTime
          studentAttendance {
            _id
            status
            comment
            commentByAreas {
              type
              content
              grade
              courseProcessFinalEvaluationTitle
            }
            student { id fullName }
          }
        }
      }
      pagination { total }
    }
  }
`;

// ============================================================
// Helpers
// ============================================================

const LMS_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

function lmsDateToUtcIso(value: string, endOfDay = false): string {
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

/**
 * Sort slots chronologically and return them.
 */
function sortSlots(slots: Class['slots']): Class['slots'] {
  return (slots ?? [])
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a?.date || (a as any)?.startTime || 0).getTime();
      const bTime = new Date(b?.date || (b as any)?.startTime || 0).getTime();
      return aTime - bTime;
    });
}

/**
 * Extract the course line tag from class name or course data.
 * E.g. "TT-C4K-GI32" → "C4K", "TL-XART-VA819-ONL-HB" → "XART"
 */
function extractCourseLineTag(
  className: string,
  courseLineName?: string,
): string {
  // Try from class name pattern: XX-TAG-...
  const match = className.match(
    /^[A-Z]{2,3}-([A-Z0-9]{2,6})-/i,
  );
  if (match) return match[1].toUpperCase();

  // Fallback to courseLine name
  if (courseLineName) {
    const short = courseLineName.replace(/\s+/g, '').toUpperCase();
    if (short.length <= 6) return short;
  }

  return '';
}

/**
 * Get the primary teacher name from a class.
 */
function getPrimaryTeacher(
  teachers: Class['teachers'],
): string {
  if (!teachers?.length) return '';

  // Prefer active teacher with instructor-like role
  const active = teachers.filter((t) => t.isActive);
  const instructor =
    active.find(
      (t) =>
        t.role?.shortName?.toLowerCase() === 'gv' ||
        t.role?.shortName?.toLowerCase() === 'instructor',
    ) || active[0];

  return instructor?.teacher?.fullName || teachers[0]?.teacher?.fullName || '';
}

/**
 * Check if a student has a submission in session 13 or 14.
 * Returns the session number (13 or 14) if found, or null.
 *
 * Logic:
 * - Sort slots by date
 * - Look at slot index 12 (session 13) and index 13 (session 14) — 0-indexed
 * - If session 14 has a submission → use session 14
 */
const FIND_ALL_STUDENT_WORKS_BY_CLASS_QUERY = /* graphql */ `
  query findAllStudentWorks($classId: String) {
    findAllStudentWorks(payload: {
      classId_in: [$classId]
    }) {
      data {
        id
        status
        studentId
        classSessionId
        classId
        version
        displayOrder
        createdAt
        lastModifiedAt
        latestData {
          title
          thumbnail
          comment
          imageUrl
          videoUrls
          attachmentUrls
          relatedUrls {
            name
            url
          }
        }
      }
    }
  }
`;

const FIND_ALL_STUDENT_WORKS_BY_CLASS_IDS_QUERY = /* graphql */ `
  query findAllStudentWorks($classIds: [String]) {
    findAllStudentWorks(payload: {
      classId_in: $classIds
    }) {
      data {
        id
        status
        studentId
        classSessionId
        classId
        version
        displayOrder
        createdAt
        lastModifiedAt
        latestData {
          title
          thumbnail
          comment
          imageUrl
          videoUrls
          attachmentUrls
          relatedUrls {
            name
            url
          }
        }
      }
    }
  }
`;

export interface StudentWorkItem {
  id: string;
  status: string;
  studentId: string;
  classSessionId: string;
  classId: string;
  version?: number;
  updatedAt?: string;
  createdAt?: string;
  lastModifiedAt?: string;
  latestData?: {
    title?: string;
    thumbnail?: string;
    comment?: string;
    imageUrl?: string[];
    videoUrls?: string[];
    attachmentUrls?: string[];
    relatedUrls?: Array<{ name?: string; url?: string }>;
  };
}

// In-memory caching to eliminate HTTP 429 Too Many Requests
interface CacheItem<T> {
  data: T;
  timestamp: number;
}
const classCache = new Map<string, CacheItem<Class>>();
const worksCache = new Map<string, CacheItem<StudentWorkItem[]>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export function getProductStatusCategory(statusRaw?: string): 'approved' | 'pending' | 'rejected' | 'draft' {
  const status = (statusRaw || '').trim().toUpperCase();
  if (!status) return 'draft';

  if (['APPROVED', 'ACCEPTED', 'PUBLISHED', 'PUBLIC'].includes(status)) {
    return 'approved';
  }
  if (['SUBMITTED', 'PENDING', 'WAITING_APPROVE', 'WAITING_APPROVAL', 'REVIEWING'].includes(status)) {
    return 'pending';
  }
  if (['REJECTED', 'DECLINED'].includes(status)) {
    return 'rejected';
  }
  return 'draft';
}

function getPriorityLevel(category: 'approved' | 'pending' | 'rejected' | 'draft'): number {
  switch (category) {
    case 'approved':
      return 1;
    case 'pending':
      return 2;
    case 'rejected':
      return 3;
    case 'draft':
      return 4;
    default:
      return 5;
  }
}

export function selectRepresentativeProduct(works: StudentWorkItem[]) {
  if (!works || works.length === 0) return null;

  // Single work -> return normally
  if (works.length === 1) {
    const single = works[0];
    const cat = getProductStatusCategory(single.status);
    const link =
      single.latestData?.relatedUrls?.[0]?.url ||
      single.latestData?.attachmentUrls?.[0] ||
      single.latestData?.imageUrl?.[0] ||
      single.latestData?.thumbnail ||
      single.latestData?.videoUrls?.[0] ||
      null;

    return {
      id: single.id,
      title: single.latestData?.title || null,
      link,
      status: single.status || 'DRAFT',
      category: cat,
      version: single.version || 1,
      updatedAt: single.lastModifiedAt || single.updatedAt || single.createdAt || null,
      totalSubmissions: 1,
    };
  }

  // Multiple works -> sort by status priority level first, then latest submitted/updated date
  const sorted = [...works].sort((a, b) => {
    const catA = getProductStatusCategory(a.status);
    const catB = getProductStatusCategory(b.status);
    const levelA = getPriorityLevel(catA);
    const levelB = getPriorityLevel(catB);

    // 1. Prioritize status category (approved (1) > pending (2) > rejected (3) > draft (4))
    if (levelA !== levelB) {
      return levelA - levelB; // Lower level number = higher priority
    }

    // 2. If status priority is equal: latest submitted/updated date first (bài nộp mới nhất)
    const dateA = a.lastModifiedAt || a.updatedAt || a.createdAt || '';
    const dateB = b.lastModifiedAt || b.updatedAt || b.createdAt || '';
    const timeA = dateA ? new Date(dateA).getTime() : 0;
    const timeB = dateB ? new Date(dateB).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA; // Date descending (latest first)
    }

    // 3. Fallback to higher version number
    const versionA = typeof a.version === 'number' ? a.version : 0;
    const versionB = typeof b.version === 'number' ? b.version : 0;
    return versionB - versionA;
  });

  const best = sorted[0];
  const cat = getProductStatusCategory(best.status);

  // Robust link extraction hierarchy
  const link =
    best.latestData?.relatedUrls?.[0]?.url ||
    best.latestData?.attachmentUrls?.[0] ||
    best.latestData?.imageUrl?.[0] ||
    best.latestData?.thumbnail ||
    best.latestData?.videoUrls?.[0] ||
    null;

  return {
    id: best.id,
    title: best.latestData?.title || null,
    link,
    status: best.status || 'DRAFT',
    category: cat,
    version: best.version || 1,
    updatedAt: best.lastModifiedAt || best.updatedAt || best.createdAt || null,
    totalSubmissions: works.length,
  };
}

/**
 * Check if a student has a submission using findAllStudentWorks data and attendance fallbacks.
 */
function checkStudentSubmissionInFinalSessions(
  sortedSlots: Class['slots'],
  studentObj: { id?: string; _id?: string } | string | null | undefined,
  studentWorksMap?: Map<string, StudentWorkItem[]>,
): {
  hasSubmission: boolean;
  session: number | null;
  workTitle?: string | null;
  workLink?: string | null;
} {
  if (!studentObj) {
    return { hasSubmission: false, session: null };
  }

  // Get candidate student IDs to match
  const candidateIds: string[] = [];
  if (typeof studentObj === 'string') {
    candidateIds.push(studentObj);
  } else {
    if (studentObj.id) candidateIds.push(studentObj.id);
    if (studentObj._id) candidateIds.push(studentObj._id);
  }

  // 1. Authoritative check via findAllStudentWorks LMS data
  if (studentWorksMap !== undefined) {
    let studentWorks: StudentWorkItem[] = [];
    for (const id of candidateIds) {
      if (studentWorksMap.has(id)) {
        studentWorks = studentWorksMap.get(id)!;
        break;
      }
    }

    if (studentWorks.length > 0) {
      const rep = selectRepresentativeProduct(studentWorks);
      if (rep) {
        return {
          hasSubmission: true,
          session: null,
          workTitle: rep.title,
          workLink: rep.link,
        };
      }
    }
  }

  // 2. Fallback check: check attendance record areas/comments
  const hasSubmissionInSlot = (
    slot: Class['slots'][number] | null,
  ): boolean => {
    if (!slot || !slot.studentAttendance) return false;
    const sa = slot.studentAttendance.find((a) => {
      const sId = a.student?.id;
      const sMongoId = (a.student as { id?: string; _id?: string })?._id;
      return candidateIds.some((id) => id === sId || id === sMongoId);
    });
    if (!sa) return false;

    // Must have an actual final product submission item in commentByAreas
    // (Excluding generic ATTENDANCE / BEHAVIOR area types)
    if (sa.commentByAreas && sa.commentByAreas.length > 0) {
      const hasProductArea = sa.commentByAreas.some((area) => {
        const typeUpper = (area.type || '').toUpperCase();
        const isGenericType =
          typeUpper === 'ATTENDANCE' ||
          typeUpper === 'BEHAVIOR' ||
          typeUpper === 'DIEM_DANH';

        const hasContent = Boolean(area.content && area.content.trim().length > 0);
        const hasGrade = area.grade !== undefined && area.grade !== null;
        const hasFinalTitle = Boolean(
          area.courseProcessFinalEvaluationTitle &&
            area.courseProcessFinalEvaluationTitle.trim().length > 0,
        );

        if (hasContent || hasGrade || hasFinalTitle) {
          return true;
        }

        if (
          !isGenericType &&
          Boolean(area.type) &&
          ['FINAL', 'PRODUCT', 'PROJECT', 'SUBMISSION', 'HOMELINK', 'EVALUATION'].some(
            (t) => typeUpper.includes(t),
          )
        ) {
          return true;
        }

        return false;
      });

      if (hasProductArea) return true;
    }

    // Or if comment contains an explicit product link or submission keyword
    if (sa.comment && sa.comment.trim().length > 0) {
      const text = sa.comment.toLowerCase();
      const isGenericAttendanceComment =
        (text.includes('nhận xét học sinh') || text.includes('auto approved')) &&
        !text.includes('http') &&
        !text.includes('drive') &&
        !text.includes('link') &&
        !text.includes('sản phẩm') &&
        !text.includes('bài nộp');

      if (!isGenericAttendanceComment) {
        return true;
      }
    }

    return false;
  };

  // Priority: Check session 14 first, then session 13
  const session14Slot = sortedSlots[sortedSlots.length - 1];
  const session13Slot = sortedSlots[sortedSlots.length - 2];

  if (hasSubmissionInSlot(session14Slot)) {
    return { hasSubmission: true, session: 14 };
  }
  if (hasSubmissionInSlot(session13Slot)) {
    return { hasSubmission: true, session: 13 };
  }

  return { hasSubmission: false, session: null };
}

// Allowed statuses: Finished & Completed
const ALLOWED_CLASS_STATUSES = new Set(['finished', 'completed']);

// ============================================================
// Main Service Functions
// ============================================================

/**
 * Fetch classes from LMS with filters, then enrich with portfolio status from DB.
 * Only returns finished/completed classes that have at least 13 sessions. Maximum 50 classes per page.
 */
export async function fetchClassesForQC(
  filter: PortfolioQCFilter,
  authHeader?: string,
): Promise<{
  data: PortfolioQCClass[];
  pagination: { total: number; pageIndex: number; itemsPerPage: number };
}> {
  const pageIndex = filter.pageIndex ?? 0;
  const itemsPerPage = 50; // Strictly 50 classes per page

  const lmsPage1Index = pageIndex * 2;
  const lmsPage2Index = lmsPage1Index + 1;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const baseVariables: Record<string, unknown> = {
    itemsPerPage: 50,
    orderBy: 'endDate_desc',
    endDateTo: filter.dateTo ? lmsDateToUtcIso(filter.dateTo, true) : nowIso,
  };

  if (filter.search) baseVariables.search = filter.search;
  if (filter.teacherId) baseVariables.teacherSlot = [filter.teacherId];
  if (filter.dateFrom) baseVariables.endDateFrom = lmsDateToUtcIso(filter.dateFrom);

  // Fetch 2 pages from LMS in parallel (100 candidate classes)
  const [response1, response2] = await Promise.all([
    callLmsApi<{
      data: { classes: { data: Class[]; pagination: { total: number } } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: { ...baseVariables, pageIndex: lmsPage1Index },
      },
      authHeader,
    ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
    callLmsApi<{
      data: { classes: { data: Class[]; pagination: { total: number } } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: { ...baseVariables, pageIndex: lmsPage2Index },
      },
      authHeader,
    ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
  ]);

  let raw1: Class[] = response1.data?.classes?.data || [];
  let raw2: Class[] = response2.data?.classes?.data || [];
  let rawTotal = response1.data?.classes?.pagination?.total || (raw1.length + raw2.length);

  // Fallback retry if 0 classes returned with endDateTo parameter
  if (raw1.length === 0 && raw2.length === 0) {
    const fallbackVariables = { ...baseVariables };
    delete fallbackVariables.endDateTo;

    const [fb1, fb2] = await Promise.all([
      callLmsApi<{ data: { classes: { data: Class[]; pagination: { total: number } } } }>(
        { query: GET_CLASSES_QC_QUERY, operationName: 'GetClasses', variables: { ...fallbackVariables, pageIndex: lmsPage1Index } },
        authHeader,
      ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
      callLmsApi<{ data: { classes: { data: Class[]; pagination: { total: number } } } }>(
        { query: GET_CLASSES_QC_QUERY, operationName: 'GetClasses', variables: { ...fallbackVariables, pageIndex: lmsPage2Index } },
        authHeader,
      ).catch(() => ({ data: { classes: { data: [], pagination: { total: 0 } } } })),
    ]);

    raw1 = fb1.data?.classes?.data || [];
    raw2 = fb2.data?.classes?.data || [];
    rawTotal = fb1.data?.classes?.pagination?.total || (raw1.length + raw2.length);
  }

  // Strictly filter classes whose end date (endDate or final slot date) is <= current time (Date.now())
  const filteredLmsClasses = [...raw1, ...raw2].filter((c) => {
    if (!c) return false;

    // Filter requirement: Only include classes with 14 sessions (numberOfSessions >= 14 or slots >= 14)
    const totalSessionsCount = c.numberOfSessions ?? c.slots?.length ?? 0;
    if (totalSessionsCount < 14) return false;

    // Filter requirement: Skip classes with 0 active students
    const activeStudentsCount = (c.students ?? []).filter((s) => s.activeInClass !== false).length;
    if (activeStudentsCount === 0) return false;

    // Determine effective end date of the class
    let endDateMs = c.endDate ? new Date(c.endDate).getTime() : 0;
    if (!endDateMs && c.slots && c.slots.length > 0) {
      const sortedSlots = sortSlots(c.slots);
      const lastSlot = sortedSlots[sortedSlots.length - 1];
      const lastDateText = lastSlot?.date || (lastSlot as any)?.startTime;
      if (lastDateText) {
        endDateMs = new Date(lastDateText).getTime();
      }
    }

    const statusLower = (c.status || '').toLowerCase();
    const isFinishedStatus =
      statusLower === 'finished' ||
      statusLower === 'completed' ||
      statusLower === 'closed' ||
      statusLower === 'ended' ||
      statusLower.includes('finish') ||
      statusLower.includes('complete') ||
      statusLower.includes('close');

    // Condition: Class end date <= Date.now() OR explicit finished status
    const isEndDatePassed = endDateMs > 0 && endDateMs <= nowMs;
    if (!isEndDatePassed && !isFinishedStatus) return false;

    // Robust Centre filter
    if (filter.centreNames?.length || filter.centres?.length) {
      const targets = filter.centreNames?.length ? filter.centreNames : filter.centres!;
      const cName = (c.centre?.name || '').toLowerCase();
      const cShort = (c.centre?.shortName || '').toLowerCase();

      const matches = targets.some((t) => {
        const tLower = t.toLowerCase();
        return (
          cName === tLower ||
          cShort === tLower ||
          cName.includes(tLower) ||
          tLower.includes(cName)
        );
      });
      if (!matches) return false;
    }

    return true;
  });

  // Limit to exactly 50 classes per page max
  const lmsClasses = filteredLmsClasses.slice(0, 50);
  const classIds = lmsClasses.map((c) => c.id);

  // Cache lmsClasses in memory
  lmsClasses.forEach((c) => {
    classCache.set(c.id, { data: c, timestamp: Date.now() });
  });

  // Fetch student works per class in small chunks (chunk size 5) & cache in memory
  const classWorksMap = new Map<string, StudentWorkItem[]>();
  if (classIds.length > 0) {
    const uncachedIds: string[] = [];
    classIds.forEach((cId) => {
      const cached = worksCache.get(cId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        classWorksMap.set(cId, cached.data);
      } else {
        uncachedIds.push(cId);
      }
    });

    if (uncachedIds.length > 0) {
      const CHUNK_SIZE = 5;
      for (let i = 0; i < uncachedIds.length; i += CHUNK_SIZE) {
        const chunk = uncachedIds.slice(i, i + CHUNK_SIZE);
        const chunkResponses = await Promise.all(
          chunk.map((cId) =>
            callLmsApi<{ data: { findAllStudentWorks: { data: StudentWorkItem[] } } }>(
              {
                query: FIND_ALL_STUDENT_WORKS_BY_CLASS_QUERY,
                operationName: 'findAllStudentWorks',
                variables: { classId: cId },
              },
              authHeader,
            ).catch((err) => {
              console.warn('[portfolio-qc] single class query failed:', cId, err);
              return { data: { findAllStudentWorks: { data: [] } } };
            })
          )
        );

        chunk.forEach((cId, idx) => {
          const worksList = chunkResponses[idx]?.data?.findAllStudentWorks?.data || [];
          worksList.forEach((w) => {
            if (!w.classId) (w as any).classId = cId;
          });
          classWorksMap.set(cId, worksList);
          worksCache.set(cId, { data: worksList, timestamp: Date.now() });
        });
      }
    }
  }

  // Transform LMS data to QC format with strict active student & representative product logic
  const data: PortfolioQCClass[] = lmsClasses.map((cls) => {
    const sortedSlots = sortSlots(cls.slots);
    // 1. Only active students (activeInClass === true)
    const activeStudents = (cls.students ?? []).filter(
      (s) => s.activeInClass !== false,
    );
    const totalStudents = activeStudents.length;
    const classWorks = classWorksMap.get(cls.id) || [];

    let submittedCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;

    for (const student of activeStudents) {
      const candidateIds: string[] = [];
      if (student.student?.id) candidateIds.push(String(student.student.id).trim().toLowerCase());
      if ((student.student as any)?._id) candidateIds.push(String((student.student as any)._id).trim().toLowerCase());
      if (student._id) candidateIds.push(String(student._id).trim().toLowerCase());

      const studentWorks = classWorks.filter((w) => {
        if (!w.studentId) return false;
        const sidLower = String(w.studentId).trim().toLowerCase();
        return candidateIds.includes(sidLower);
      });

      // Select 1 representative product by priority & tie-breakers for this class
      const rep = selectRepresentativeProduct(studentWorks);
      const hasSub = rep !== null || studentWorks.length > 0;

      if (hasSub) {
        submittedCount++;
        const cat = rep?.category || 'pending';
        if (cat === 'approved') {
          approvedCount++;
        } else if (cat === 'rejected') {
          rejectedCount++;
        } else {
          pendingCount++;
        }
      }
    }

    if (submittedCount > 0) {
      console.log(`[portfolio-qc] Class ${cls.name} (${cls.id}): ${submittedCount}/${totalStudents} active students submitted SPCK`);
    }

    const missingCount = Math.max(0, totalStudents - submittedCount);
    const submissionRatio = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
    const approvalRatio = submittedCount > 0 ? Math.round((approvedCount / submittedCount) * 100) : 0;

    let qcStatus: 'completed' | 'partial' | 'none' = 'none';
    if (submittedCount === totalStudents && totalStudents > 0) {
      qcStatus = 'completed';
    } else if (submittedCount > 0) {
      qcStatus = 'partial';
    }

    const courseLineTag = extractCourseLineTag(
      cls.name,
      cls.course?.courseLine?.name,
    );

    const finalSessionDate = sortedSlots.length > 0
      ? sortedSlots[sortedSlots.length - 1].date
      : cls.endDate;

    // Evaluate missing Checkpoint 1 & 2 / SPCK scores for active students
    let hasCheckpointScore = false;
    (sortedSlots || []).forEach((slot) => {
      (slot.studentAttendance || []).forEach((att) => {
        if (att.commentByAreas && att.commentByAreas.length > 0) {
          const hasScore = att.commentByAreas.some(
            (area) => area.grade !== undefined && area.grade !== null,
          );
          if (hasScore) hasCheckpointScore = true;
        } else if (att.comment && /điểm|checkpoint|cp|score/i.test(att.comment)) {
          hasCheckpointScore = true;
        }
      });
    });

    const hasMissingCheckpoint = (missingCount > 0 || !hasCheckpointScore) && totalStudents > 0;

    return {
      id: cls.id,
      name: cls.name,
      status: cls.status,
      startDate: cls.startDate,
      endDate: cls.endDate,
      finalSessionDate,
      courseName: cls.course?.name || '',
      courseShortName: cls.course?.shortName || '',
      courseLineTag,
      centreName: cls.centre?.name || '',
      centreShortName: cls.centre?.shortName || '',
      teacherName: getPrimaryTeacher(cls.teachers),
      totalSessions: sortedSlots.length,
      totalStudents,
      submittedCount,
      missingCount,
      approvedCount,
      rejectedCount,
      pendingCount,
      submissionRatio,
      approvalRatio,
      qcStatus,
      hasMissingCheckpoint,
    };
  });

  // Filter by QC status if requested
  let filteredData = data;
  if (filter.qcStatus) {
    filteredData = filteredData.filter((cls) => cls.qcStatus === filter.qcStatus);
  }

  return {
    data: filteredData,
    pagination: { total: rawTotal, pageIndex, itemsPerPage: 50 },
  };
}

/**
 * Get detailed student list for a specific class, including submission status.
 */
export async function getClassStudentDetails(
  classId: string,
  className?: string,
  authHeader?: string,
): Promise<{
  className: string;
  students: PortfolioQCStudent[];
}> {
  // 1. Check in-memory classCache first
  let cls = classCache.get(classId)?.data;
  if (!cls && className) {
    for (const item of classCache.values()) {
      if (item.data.name === className) {
        cls = item.data;
        break;
      }
    }
  }

  // 2. If class object is not in cache, query LMS API
  if (!cls) {
    const searchTerm = className || classId;
    const response = await callLmsApi<{
      data: { classes: { data: Class[] } };
    }>(
      {
        query: GET_CLASSES_QC_QUERY,
        operationName: 'GetClasses',
        variables: {
          search: searchTerm,
          pageIndex: 0,
          itemsPerPage: 30,
        },
      },
      authHeader,
    );

    cls = (response.data?.classes?.data || []).find(
      (c) => c.id === classId || c.name === className || c.name === classId,
    );

    if (!cls) {
      const fallbackResponse = await callLmsApi<{
        data: { classes: { data: Class[] } };
      }>(
        {
          query: GET_CLASSES_QC_QUERY,
          operationName: 'GetClasses',
          variables: {
            pageIndex: 0,
            itemsPerPage: 100,
          },
        },
        authHeader,
      );
      cls = (fallbackResponse.data?.classes?.data || []).find(
        (c) => c.id === classId || c.name === className,
      );
    }
  }

  if (!cls) {
    return { className: className || '', students: [] };
  }

  // Save to classCache
  classCache.set(cls.id, { data: cls, timestamp: Date.now() });

  const sortedSlots = sortSlots(cls.slots);
  const activeStudents = (cls.students ?? []).filter(
    (s) => s.activeInClass !== false,
  );

  // 3. Check in-memory worksCache for student works
  let classWorks: StudentWorkItem[] = [];
  const cachedWorks = worksCache.get(cls.id);
  if (cachedWorks && Date.now() - cachedWorks.timestamp < CACHE_TTL_MS) {
    classWorks = cachedWorks.data;
  } else {
    try {
      const worksRes = await callLmsApi<{
        data: { findAllStudentWorks: { data: StudentWorkItem[] } };
      }>(
        {
          query: FIND_ALL_STUDENT_WORKS_BY_CLASS_QUERY,
          operationName: 'findAllStudentWorks',
          variables: { classId: cls.id },
        },
        authHeader,
      );
      classWorks = worksRes.data?.findAllStudentWorks?.data || [];
      worksCache.set(cls.id, { data: classWorks, timestamp: Date.now() });
    } catch (e) {
      console.warn('[portfolio-qc] single class findAllStudentWorks failed:', e);
    }
  }

  // Get portfolio status from DB
  let portfolioMap: Record<
    string,
    { id: string | number; status: string; slug: string | null }
  > = {};
  try {
    const dbResult = await pool.query(
      `SELECT id::text as id, student_lms_id::text as student_lms_id, status, public_slug
       FROM portfolios
       WHERE class_lms_id::text = $1`,
      [classId],
    );
    portfolioMap = Object.fromEntries(
      dbResult.rows.map(
        (r: {
          id: string | number;
          student_lms_id: string;
          status: string;
          public_slug: string | null;
        }) => [
          r.student_lms_id,
          { id: r.id, status: r.status, slug: r.public_slug },
        ],
      ),
    );
  } catch {
    // portfolios table might not exist yet
  }

  const students: PortfolioQCStudent[] = activeStudents.map((s) => {
    const candidateIds: string[] = [];
    if (s.student?.id) candidateIds.push(String(s.student.id).trim().toLowerCase());
    if ((s.student as any)?._id) candidateIds.push(String((s.student as any)._id).trim().toLowerCase());
    if (s._id) candidateIds.push(String(s._id).trim().toLowerCase());

    const studentWorks = classWorks.filter((w) => {
      if (!w.studentId) return false;
      const sidLower = String(w.studentId).trim().toLowerCase();
      return candidateIds.includes(sidLower);
    });

    const rep = selectRepresentativeProduct(studentWorks);
    const hasSubmission = rep !== null || studentWorks.length > 0;
    const studentId = s.student?.id || (s.student as any)?._id || s._id;
    const portfolio = portfolioMap[studentId];

    return {
      studentId,
      studentName: s.student?.fullName || '',
      activeInClass: s.activeInClass !== false,
      hasSubmission,
      submissionSession: null,
      submissionCount: hasSubmission ? 1 : 0,
      submissionRatio: hasSubmission ? 100 : 0,
      submissionTitle: rep?.title || null,
      submissionLink: rep?.link || null,
      representativeProduct: rep,
      portfolioStatus: portfolio
        ? (portfolio.status as 'draft' | 'published')
        : 'none',
      portfolioId: portfolio?.id ?? null,
      portfolioSlug: portfolio?.slug ?? null,
    };
  });

  // Sort: students with submissions first, then alphabetically
  students.sort((a, b) => {
    if (a.hasSubmission !== b.hasSubmission)
      return a.hasSubmission ? -1 : 1;
    return a.studentName.localeCompare(b.studentName);
  });

  return {
    className: cls.name,
    students,
  };
}
