import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import type { UponSanitizeAttributeHookEvent } from 'dompurify';
import DOMPurify from 'isomorphic-dompurify';
import { NextRequest, NextResponse } from 'next/server';

const LMS_API_URL = process.env.LMS_API_URL || 'https://lms-api.mindx.edu.vn/';
const WRITE_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 256 * 1024;
const inFlightWrites = new Set<string>();

const TEACHER_FIELDS = /* graphql */ `
  _id
  isActive
  teacher { id user fullName username code email imageUrl }
  role { id name shortName }
`;

const COMMENT_AREA_FIELDS = /* graphql */ `
  id
  name
  translations { key value locale }
  fieldName
  type
  slots
  rates { value commentSamples }
  checkpoint {
    gradeFrom
    gradeTo
    questions { question grade id }
  }
  demo { id title maxScore }
  sortOrder
  isActive
  isPublic
  isRequired
  guideline
`;

const COURSE_PROCESS_FIELDS = /* graphql */ `
  id
  isActive
  alwaysShowDefault
  defaultCommentAreas { ${COMMENT_AREA_FIELDS} }
  specificSessions {
    session
    alwaysShow
    commentAreas { ${COMMENT_AREA_FIELDS} }
  }
  finalSession {
    id
    finalEvaluations {
      id
      title
      alwaysShow
      commentAreas { ${COMMENT_AREA_FIELDS} }
    }
    demoScore {
      id
      alwaysShow
      commentAreas { ${COMMENT_AREA_FIELDS} }
    }
  }
  checkpointSessions {
    id
    session
    alwaysShow
    checkpointCommentArea { ${COMMENT_AREA_FIELDS} }
    otherComments { ${COMMENT_AREA_FIELDS} }
    evaluations {
      id
      title
      alwaysShow
      commentAreas { ${COMMENT_AREA_FIELDS} }
    }
  }
  name
  description
`;

const COMMENT_BY_AREA_FIELDS = /* graphql */ `
  grade
  content
  commentAreaId
  type
  courseProcessFinalEvaluationId
  courseProcessFinalEvaluationTitle
  courseProcessDemoId
  checkpoint {
    practiceScore
    checkpointScore
    checkpointQuestions { title result score id }
  }
  demoQuestions {
    courseProcessDemoDetailId
    title
    result
    score
    maxScore
  }
`;

const COMMENT_CLASS_FIELDS = /* graphql */ `
  id
  name
  status
  numberOfSessions
  courseProcessId
  courseProcess { ${COURSE_PROCESS_FIELDS} }
  course {
    id
    name
    shortName
    courseProcess { ${COURSE_PROCESS_FIELDS} }
  }
  operator { id email username displayName firstName middleName lastName }
  teachers { ${TEACHER_FIELDS} }
  students {
    _id
    activeInClass
    classSite { _id name }
    student {
      id
      fullName
      email
      gender
      imageUrl
      customer { fullName phoneNumber email }
    }
  }
  classSites {
    _id
    name
    operator { id email username displayName firstName middleName lastName }
    teachers { ${TEACHER_FIELDS} }
    classSiteSlots {
      classSlotId
      teachers { ${TEACHER_FIELDS} }
    }
  }
  slots {
    _id
    index
    date
    startTime
    endTime
    summary
    homework
    teachers { ${TEACHER_FIELDS} }
    studentAttendance {
      _id
      status
      comment
      sendCommentStatus
      commentStatus { status version feedback }
      commentByAreas { ${COMMENT_BY_AREA_FIELDS} }
      student { id fullName email gender imageUrl }
    }
  }
`;

const GET_COMMENT_CLASS_QUERY = /* graphql */ `
  query GetCommentClassById($id: ID!) {
    classesById(id: $id) { ${COMMENT_CLASS_FIELDS} }
  }
`;

const GET_DEFAULT_COMMENT_AREAS_QUERY = /* graphql */ `
  query StudentCommentAreas($payload: FindCommentAreasInput!) {
    studentCommentAreas(payload: $payload) {
      data { ${COMMENT_AREA_FIELDS} }
      pagination { total }
    }
  }
`;

const GET_STUDENT_CHECKPOINT_QUERY = /* graphql */ `
  query FindOneStudentCheckpoint($payload: FindOneStudentCheckpointPayload) {
    findOneStudentCheckpoint(payload: $payload) {
      id
      studentId
      classId
      sessionId
      sessionNumber
      commentAreaId
      commented
      scoreDetail {
        practiceScore
        checkpointScore
        checkpointQuestions { title score result id }
      }
      studentSubmissions { id score type isDeleted }
    }
  }
`;

const UPDATE_SLOT_COMMENT_MUTATION = /* graphql */ `
  mutation UpdateSlotComment($payload: UpdateSlotCommentCommand!) {
    classes {
      updateSlotComment(payload: $payload) {
        id
      }
    }
  }
`;

type SlotKind = 'NONE' | 'DEFAULT' | 'SPECIAL' | 'CHECKPOINT' | 'FINAL';

type AreaSelection = {
  kind: SlotKind;
  alwaysShow: boolean;
  areas: any[];
};

type SubmittedArea = {
  commentAreaId: string;
  type: string;
  content: string;
  grade?: number;
  checkpoint?: {
    practiceScore: number;
    checkpointScore: number;
    checkpointQuestions: Array<{
      id: string;
      title: string;
      result: boolean;
      score: number;
    }>;
  };
  demoQuestions?: Array<{
    courseProcessDemoDetailId: string;
    title: string;
    result: boolean;
    score: number;
    maxScore: number;
  }>;
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

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function safeIdentifier(value: unknown): string {
  const text = String(value ?? '').trim();
  return /^[a-zA-Z0-9_-]{1,128}$/.test(text) ? text : '';
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function sameInstant(a: unknown, b: unknown): boolean {
  if (!a || !b) return true;
  const left = new Date(String(a)).getTime();
  const right = new Date(String(b)).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1_000;
}

function slotTimestamp(slot: any): number | null {
  const value = new Date(slot?.startTime || slot?.date || '').getTime();
  return Number.isFinite(value) ? value : null;
}

function sortedSlots(cls: any): any[] {
  return (cls?.slots || []).slice().sort((left: any, right: any) => {
    const leftIndex = finiteNumber(left?.index);
    const rightIndex = finiteNumber(right?.index);
    if (leftIndex !== undefined && rightIndex !== undefined && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return (slotTimestamp(left) || 0) - (slotTimestamp(right) || 0);
  });
}

function courseProcessForClass(cls: any): any | null {
  return cls?.courseProcess || cls?.course?.courseProcess || null;
}

function lmsSlotType(kind: SlotKind): string {
  switch (kind) {
    case 'NONE':
      return 'None';
    case 'FINAL':
      return 'Final';
    case 'CHECKPOINT':
      return 'CheckPoint';
    case 'SPECIAL':
      return 'Special';
    default:
      return 'Default';
  }
}

function asAreaList(value: unknown): any[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asMaybeAreaList(value: unknown): any[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function uniqueAreas(areas: any[]): any[] {
  const seen = new Set<string>();
  return areas.filter((area) => {
    const id = String(area?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return area?.isActive !== false;
  });
}

function decorateArea(area: any, extra: Record<string, unknown> = {}): any {
  return {
    ...area,
    id: String(area?.id || ''),
    name: String(area?.name || area?.fieldName || 'Tiêu chí nhận xét'),
    fieldName: String(area?.fieldName || ''),
    type: normalizeStatus(area?.type) || 'CONTENT',
    rates: asAreaList(area?.rates),
    demo: asMaybeAreaList(area?.demo),
    ...extra,
  };
}

function areasForSession(
  cls: any,
  sessionNumber: number,
  fallbackAreas: any[] = [],
): AreaSelection {
  const process = courseProcessForClass(cls);
  const total = Number(cls?.numberOfSessions || sortedSlots(cls).length || 14) || 14;

  if (!process) {
    return {
      kind: 'NONE',
      alwaysShow: false,
      areas: uniqueAreas(fallbackAreas.map((area) => decorateArea(area))),
    };
  }

  if (sessionNumber === total && process?.finalSession) {
    const finalEvaluations = asAreaList(process.finalSession?.finalEvaluations);
    const demoScore = process.finalSession?.demoScore;
    const demoAreas = asAreaList(demoScore?.commentAreas).map((area) => decorateArea(area, {
      courseProcessDemoId: String(demoScore?.id || ''),
      sectionTitle: 'Sản phẩm cuối khóa',
    }));
    const evaluationAreas = finalEvaluations.flatMap((evaluation) =>
      asAreaList(evaluation?.commentAreas).map((area) => decorateArea(area, {
        courseProcessFinalEvaluationId: String(evaluation?.id || ''),
        courseProcessFinalEvaluationTitle: String(evaluation?.title || ''),
        sectionTitle: String(evaluation?.title || 'Đánh giá cuối khóa'),
        requiresGrade: true,
      })),
    );
    return {
      kind: 'FINAL',
      alwaysShow: true,
      areas: uniqueAreas([...demoAreas, ...evaluationAreas]),
    };
  }

  const checkpoint = asAreaList(process?.checkpointSessions).find(
    (item) => Number(item?.session) === sessionNumber,
  );
  if (checkpoint) {
    const checkpointArea = checkpoint?.checkpointCommentArea
      ? [decorateArea(checkpoint.checkpointCommentArea, { sectionTitle: 'Điểm checkpoint' })]
      : [];
    const evaluationAreas = asAreaList(checkpoint?.evaluations).flatMap((evaluation) =>
      asAreaList(evaluation?.commentAreas).map((area) => decorateArea(area, {
        courseProcessCheckpointEvaluationId: String(evaluation?.id || ''),
        courseProcessCheckpointEvaluationTitle: String(evaluation?.title || ''),
        sectionTitle: String(evaluation?.title || 'Đánh giá năng lực'),
        requiresGrade: true,
      })),
    );
    const otherAreas = asAreaList(checkpoint?.otherComments).map((area) =>
      decorateArea(area, { sectionTitle: 'Nhận xét bổ sung' }),
    );
    return {
      kind: 'CHECKPOINT',
      alwaysShow: Boolean(checkpoint?.alwaysShow),
      areas: uniqueAreas([...checkpointArea, ...evaluationAreas, ...otherAreas]),
    };
  }

  const special = asAreaList(process?.specificSessions).find(
    (item) => Number(item?.session) === sessionNumber,
  );
  if (special) {
    return {
      kind: 'SPECIAL',
      alwaysShow: Boolean(special?.alwaysShow),
      areas: uniqueAreas(asAreaList(special?.commentAreas).map((area) => decorateArea(area))),
    };
  }

  return {
    kind: 'DEFAULT',
    alwaysShow: Boolean(process?.alwaysShowDefault),
    areas: uniqueAreas(asAreaList(process?.defaultCommentAreas).map((area) => decorateArea(area))),
  };
}

function studentsForClassSite(cls: any, classSiteId: string): any[] {
  const classSiteCount = Array.isArray(cls?.classSites) ? cls.classSites.length : 0;
  return (cls?.students || []).filter((row: any) => {
    if (row?.activeInClass === false) return false;
    const rowClassSiteId = String(row?.classSite?._id || '');
    return rowClassSiteId === classSiteId || (!rowClassSiteId && classSiteCount <= 1);
  });
}

function uniqueAssignments(assignments: any[]): any[] {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (assignment?.isActive === false) return false;
    const id = String(assignment?.teacher?.id || assignment?.teacher?.email || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function assignmentsForSlot(classSite: any, slot: any): any[] {
  const classSiteSlot = (classSite?.classSiteSlots || []).find(
    (item: any) => String(item?.classSlotId || '') === String(slot?._id || ''),
  );
  if (classSiteSlot) return uniqueAssignments(classSiteSlot?.teachers || []);
  return uniqueAssignments(slot?.teachers || classSite?.teachers || []);
}

function canUpdateSlot(cls: any, classSite: any, slot: any, userEmail: string): boolean {
  const operatorMatch = [cls?.operator, classSite?.operator].some(
    (operator) => normalizeEmail(operator?.email) === userEmail,
  );
  const teacherMatch = assignmentsForSlot(classSite, slot).some(
    (assignment) => normalizeEmail(assignment?.teacher?.email) === userEmail,
  );
  return operatorMatch || teacherMatch;
}

function mapCommentAreaValue(value: any) {
  return {
    commentAreaId: String(value?.commentAreaId || ''),
    type: normalizeStatus(value?.type) || 'CONTENT',
    content: String(value?.content || ''),
    ...(finiteNumber(value?.grade) !== undefined ? { grade: Number(value.grade) } : {}),
    ...(value?.checkpoint ? { checkpoint: value.checkpoint } : {}),
    ...(Array.isArray(value?.demoQuestions) ? { demoQuestions: value.demoQuestions } : {}),
    ...(value?.courseProcessFinalEvaluationId ? {
      courseProcessFinalEvaluationId: String(value.courseProcessFinalEvaluationId),
      courseProcessFinalEvaluationTitle: String(value.courseProcessFinalEvaluationTitle || ''),
    } : {}),
    ...(value?.courseProcessDemoId ? {
      courseProcessDemoId: String(value.courseProcessDemoId),
    } : {}),
  };
}

function mapCommentClass(cls: any, fallbackAreas: any[] = [], userEmail = '') {
  const slots = sortedSlots(cls);
  const classSites = asAreaList(cls?.classSites).map((site) => ({
    id: String(site?._id || ''),
    name: String(site?.name || 'Default'),
  })).filter((site) => site.id);

  return {
    id: String(cls?.id || ''),
    name: String(cls?.name || ''),
    status: normalizeStatus(cls?.status),
    numberOfSessions: Number(cls?.numberOfSessions || slots.length || 14),
    courseName: String(cls?.course?.name || ''),
    classSites,
    hasCourseProcess: Boolean(courseProcessForClass(cls)),
    slots: slots.map((slot, index) => {
      const sessionNumber = Number(slot?.index) >= 0 ? Number(slot.index) + 1 : index + 1;
      const selection = areasForSession(cls, sessionNumber, fallbackAreas);
      const attendanceByStudent = new Map(
        asAreaList(slot?.studentAttendance).map((attendance) => [
          String(attendance?.student?.id || ''),
          attendance,
        ]),
      );

      return {
        id: String(slot?._id || ''),
        sessionNumber,
        date: slot?.date || slot?.startTime || null,
        startTime: slot?.startTime || null,
        endTime: slot?.endTime || null,
        summary: String(slot?.summary || ''),
        homework: String(slot?.homework || ''),
        kind: selection.kind,
        alwaysShow: selection.alwaysShow,
        areas: selection.areas,
        editableClassSiteIds: userEmail
          ? asAreaList(cls?.classSites)
            .filter((site) => canUpdateSlot(cls, site, slot, userEmail))
            .map((site) => String(site?._id || ''))
            .filter(Boolean)
          : [],
        students: (cls?.students || [])
          .filter((row: any) => row?.activeInClass !== false)
          .map((row: any) => {
            const student = row?.student || {};
            const studentId = String(student?.id || '');
            const attendance = attendanceByStudent.get(studentId) as any;
            return {
              id: studentId,
              fullName: String(student?.fullName || 'Học viên'),
              imageUrl: student?.imageUrl || null,
              gender: student?.gender || null,
              classSiteId: String(row?.classSite?._id || ''),
              attendanceId: attendance?._id ? String(attendance._id) : null,
              attendanceStatus: normalizeStatus(attendance?.status) || 'NOT_RECORDED',
              comment: String(attendance?.comment || ''),
              sendCommentStatus: attendance?.sendCommentStatus || null,
              commentStatus: attendance?.commentStatus || null,
              commentByAreas: asAreaList(attendance?.commentByAreas).map(mapCommentAreaValue),
            };
          })
          .filter((student: { id: string }) => Boolean(student.id))
          .sort((left: { fullName: string }, right: { fullName: string }) =>
            left.fullName.localeCompare(right.fullName, 'vi'),
          ),
      };
    }),
  };
}

async function callLmsOnce<T>(
  request: { query: string; variables?: Record<string, unknown>; operationName?: string },
  authHeader: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);

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
    const responseText = await response.text();
    const result = (() => {
      try {
        return JSON.parse(responseText) as {
          data?: unknown;
          errors?: Array<{ message?: string; extensions?: { code?: string } }>;
          message?: string | string[];
          error?: string;
        };
      } catch {
        return null;
      }
    })();
    const graphQlMessages = (result?.errors || [])
      .map((error) => error.message)
      .filter((message): message is string => Boolean(message));
    const responseMessages = Array.isArray(result?.message)
      ? result.message
      : result?.message
        ? [result.message]
        : [];
    const lmsMessages = [...graphQlMessages, ...responseMessages, result?.error || ''].filter(Boolean);
    const safeLmsMessage = lmsMessages
      .join('; ')
      .replace(/Variable "\$[^"]+" got invalid value[\s\S]*?;\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    if (!response.ok) {
      const errors = result?.errors || [];
      const isBadInput = response.status === 400
        || errors.some((error) => error.extensions?.code === 'BAD_USER_INPUT');
      console.error('[nhan-xet-lop-hoc] LMS write rejected:', {
        status: response.status,
        errors,
        message: result?.message,
        error: result?.error,
        unparsedBody: result ? undefined : responseText.slice(0, 1_000),
      });
      throw new LmsRequestError(
        response.status === 429
          ? 'LMS đang giới hạn tần suất. TPS không tự gửi lại để tránh ghi trùng.'
          : isBadInput
            ? safeLmsMessage
              ? `LMS không chấp nhận dữ liệu nhận xét: ${safeLmsMessage}`
              : 'LMS không chấp nhận cấu trúc dữ liệu nhận xét. Chi tiết đã được ghi trong log TPS.'
            : `LMS từ chối yêu cầu lưu nhận xét (HTTP ${response.status}).`,
        response.status === 429 ? 429 : isBadInput ? 400 : 502,
      );
    }
    if (!result) throw new LmsRequestError('LMS trả về dữ liệu không hợp lệ.');
    if (result.errors?.length) {
      throw new LmsRequestError(safeLmsMessage || 'LMS không chấp nhận dữ liệu nhận xét.');
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

async function fetchCommentClass(classId: string, authHeader: string): Promise<any> {
  const result = await callLmsApi<any>({
    query: GET_COMMENT_CLASS_QUERY,
    operationName: 'GetCommentClassById',
    variables: { id: classId },
  }, authHeader);
  return result?.data?.classesById || null;
}

async function fetchFallbackAreas(authHeader: string): Promise<any[]> {
  try {
    const result = await callLmsApi<any>({
      query: GET_DEFAULT_COMMENT_AREAS_QUERY,
      operationName: 'StudentCommentAreas',
      variables: {
        payload: {
          filter: {
            isActive_equals: true,
            slots_in: [],
            type_in: ['CONTENT', 'RATE'],
          },
          pagination: { paginationType: 'NONE' },
          orderBy: 'sortOrder_DESC',
        },
      },
    }, authHeader);
    return asAreaList(result?.data?.studentCommentAreas?.data);
  } catch (error) {
    console.warn('[nhan-xet-lop-hoc] Không tải được tiêu chí mặc định:', error);
    return [];
  }
}

function parseSubmittedAreas(value: unknown): SubmittedArea[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const seen = new Set<string>();
  const parsed: SubmittedArea[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const commentAreaId = safeIdentifier(row.commentAreaId);
    const type = normalizeStatus(row.type);
    if (!commentAreaId || seen.has(commentAreaId) || !['CONTENT', 'RATE', 'CHECKPOINT', 'DEMO'].includes(type)) {
      return null;
    }
    seen.add(commentAreaId);
    const submitted: SubmittedArea = {
      commentAreaId,
      type,
      content: safeText(row.content, 12_000),
    };
    const grade = finiteNumber(row.grade);
    if (grade !== undefined) submitted.grade = grade;

    if (type === 'CHECKPOINT') {
      const checkpoint = row.checkpoint;
      if (!checkpoint || typeof checkpoint !== 'object') return null;
      const source = checkpoint as Record<string, unknown>;
      const practiceScore = finiteNumber(source.practiceScore);
      const questions = source.checkpointQuestions;
      if (practiceScore === undefined || !Array.isArray(questions) || questions.length > 100) return null;
      const parsedQuestions = questions.map((question) => {
        if (!question || typeof question !== 'object') return null;
        const entry = question as Record<string, unknown>;
        const id = safeIdentifier(entry.id);
        const score = finiteNumber(entry.score);
        if (!id || score === undefined || score < 0 || score > 100) return null;
        return {
          id,
          title: safeText(entry.title, 500),
          result: Boolean(entry.result),
          score,
        };
      });
      if (parsedQuestions.some((question) => question === null)) return null;
      const validQuestions = parsedQuestions as Array<{
        id: string;
        title: string;
        result: boolean;
        score: number;
      }>;
      const checkpointScore = validQuestions.reduce(
        (total, question) => total + (question.result ? question.score : 0),
        0,
      );
      submitted.checkpoint = {
        practiceScore,
        checkpointScore,
        checkpointQuestions: validQuestions,
      };
    }

    if (type === 'DEMO') {
      const questions = row.demoQuestions;
      if (!Array.isArray(questions) || questions.length > 100) return null;
      const parsedQuestions = questions.map((question) => {
        if (!question || typeof question !== 'object') return null;
        const entry = question as Record<string, unknown>;
        const id = safeIdentifier(entry.courseProcessDemoDetailId);
        const score = finiteNumber(entry.score);
        const maxScore = finiteNumber(entry.maxScore);
        if (!id || score === undefined || maxScore === undefined || score < 0 || score > maxScore) return null;
        return {
          courseProcessDemoDetailId: id,
          title: safeText(entry.title, 500),
          result: Boolean(entry.result),
          score,
          maxScore,
        };
      });
      if (parsedQuestions.some((question) => question === null)) return null;
      submitted.demoQuestions = parsedQuestions as NonNullable<SubmittedArea['demoQuestions']>;
    }

    parsed.push(submitted);
  }
  return parsed;
}

function hasMeaningfulAreaValue(value: SubmittedArea): boolean {
  if (value.type === 'RATE') return value.grade !== undefined;
  if (value.type === 'CONTENT') return Boolean(richTextToPlain(value.content)) || value.grade !== undefined;
  if (value.type === 'CHECKPOINT') return Boolean(value.checkpoint);
  return Boolean(value.demoQuestions?.length);
}

function validateAndDecorateAreas(
  submitted: SubmittedArea[],
  selection: AreaSelection,
): { ok: true; values: any[] } | { ok: false; message: string } {
  const submittedById = new Map(submitted.map((value) => [value.commentAreaId, value]));
  const allowedIds = new Set(selection.areas.map((area) => String(area.id)));
  if (submitted.some((value) => !allowedIds.has(value.commentAreaId))) {
    return { ok: false, message: 'Tiêu chí nhận xét đã thay đổi trên LMS. Hãy tải lại.' };
  }

  const values: any[] = [];
  for (const area of selection.areas) {
    const areaId = String(area.id);
    const type = normalizeStatus(area.type) || 'CONTENT';
    const value = submittedById.get(areaId);
    const required = Boolean(area.isRequired) || Boolean(area.requiresGrade);
    if (!value || !hasMeaningfulAreaValue(value)) {
      if (required) return { ok: false, message: `Vui lòng hoàn thành tiêu chí “${area.name}”.` };
      continue;
    }
    if (value.type !== type) {
      return { ok: false, message: `Loại tiêu chí “${area.name}” không còn khớp với LMS.` };
    }

    const trusted: any = {
      commentAreaId: areaId,
      type,
      content: value.content,
    };

    if (type === 'RATE') {
      const rates = asAreaList(area.rates).map((rate) => finiteNumber(rate?.value)).filter(
        (rate): rate is number => rate !== undefined,
      );
      if (value.grade === undefined || (rates.length > 0 && !rates.includes(value.grade))) {
        return { ok: false, message: `Mức đánh giá của “${area.name}” không hợp lệ.` };
      }
      trusted.grade = value.grade;
    } else if (type === 'CONTENT') {
      if (area.requiresGrade) {
        if (value.grade === undefined || value.grade < 0 || value.grade > 5 || !richTextToPlain(value.content)) {
          return { ok: false, message: `Vui lòng nhập đủ điểm và nhận xét cho “${area.name}”.` };
        }
        trusted.grade = value.grade;
      } else if (value.grade !== undefined) {
        trusted.grade = value.grade;
      }
    } else if (type === 'CHECKPOINT') {
      const config = area?.checkpoint || {};
      const questions = asAreaList(config?.questions);
      const byId = new Map(value.checkpoint?.checkpointQuestions.map((question) => [question.id, question]));
      if (!value.checkpoint || questions.some((question) => !byId.has(String(question?.id || '')))) {
        return { ok: false, message: `Điểm checkpoint của “${area.name}” chưa đầy đủ.` };
      }
      const gradeFrom = finiteNumber(config?.gradeFrom);
      const gradeTo = finiteNumber(config?.gradeTo);
      if (
        (gradeFrom !== undefined && value.checkpoint.practiceScore < gradeFrom) ||
        (gradeTo !== undefined && value.checkpoint.practiceScore > gradeTo)
      ) {
        return { ok: false, message: `Điểm thực hành của “${area.name}” nằm ngoài khoảng cho phép.` };
      }
      trusted.checkpoint = value.checkpoint;
    } else if (type === 'DEMO') {
      const details = asAreaList(area?.demo);
      const submittedDetails = value.demoQuestions || [];
      const byId = new Map(submittedDetails.map((detail) => [detail.courseProcessDemoDetailId, detail]));
      if (details.length > 0 && details.some((detail) => !byId.has(String(detail?.id || '')))) {
        return { ok: false, message: `Điểm sản phẩm của “${area.name}” chưa đầy đủ.` };
      }
      trusted.demoQuestions = submittedDetails;
      trusted.grade = submittedDetails.reduce((total, detail) => total + detail.score, 0);
    }

    if (area.courseProcessFinalEvaluationId) {
      trusted.courseProcessFinalEvaluationId = area.courseProcessFinalEvaluationId;
      trusted.courseProcessFinalEvaluationTitle = area.courseProcessFinalEvaluationTitle;
    }
    if (area.courseProcessCheckpointEvaluationId) {
      trusted.courseProcessCheckpointEvaluationId = area.courseProcessCheckpointEvaluationId;
      trusted.courseProcessCheckpointEvaluationTitle = area.courseProcessCheckpointEvaluationTitle;
    }
    if (area.courseProcessDemoId) trusted.courseProcessDemoId = area.courseProcessDemoId;
    values.push(trusted);
  }

  return { ok: true, values };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function richTextToPlain(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join('\n')
    .trim();
}

function editorTextToHtml(value: string): string {
  if (!value.trim()) return '';
  return value
    .split(/\r?\n/)
    .map((line) => line.trim() ? `<p>${escapeHtml(line.trim())}</p>` : '<p><br></p>')
    .join('');
}

const COMMENT_ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'div', 'ul', 'ol', 'li'];
const COMMENT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

function keepCommentTextAlignment(
  _node: Element,
  data: UponSanitizeAttributeHookEvent,
): void {
  if (data.attrName.toLowerCase() !== 'style') return;
  const match = /^\s*text-align\s*:\s*([a-z]+)\s*;?\s*$/i.exec(data.attrValue);
  const alignment = match?.[1]?.toLowerCase() || '';
  if (!COMMENT_ALIGNMENTS.has(alignment)) {
    data.keepAttr = false;
    return;
  }
  data.attrValue = `text-align: ${alignment}`;
}

function sanitizeCommentHtml(value: string): string {
  DOMPurify.addHook('uponSanitizeAttribute', keepCommentTextAlignment);
  try {
    return String(DOMPurify.sanitize(value, {
      ALLOWED_TAGS: COMMENT_ALLOWED_TAGS,
      ALLOWED_ATTR: ['style'],
    })).trim();
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', keepCommentTextAlignment);
  }
}

function normalizeSubmittedRichText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const html = /<\/?[a-z][^>]*>/i.test(trimmed) ? trimmed : editorTextToHtml(trimmed);
  const sanitized = sanitizeCommentHtml(html);
  return richTextToPlain(sanitized) ? sanitized : '';
}

function buildLmsAreaContent(area: any, value: any): string {
  const type = normalizeStatus(value?.type);
  const areaName = String(area?.name || area?.fieldName || 'Nhận xét');
  const enteredContent = String(value?.content || '').trim();

  if (type === 'RATE') {
    // LMS stores RATE samples as plain text. Sending editor HTML makes LMS show
    // literal <p> tags and prevents it from matching the selected rate sample.
    const plainContent = richTextToPlain(enteredContent);
    if (plainContent) return plainContent;

    const grade = finiteNumber(value?.grade);
    const selectedRate = asAreaList(area?.rates).find(
      (rate) => finiteNumber(rate?.value) === grade,
    );
    const sample = asAreaList(selectedRate?.commentSamples)
      .find((comment) => typeof comment === 'string' && richTextToPlain(comment));
    if (sample) return richTextToPlain(sample);
    return grade === undefined
      ? ''
      : `${areaName}: ${grade} điểm`;
  }

  if (type === 'CHECKPOINT' && value?.checkpoint) {
    const checkpoint = value.checkpoint;
    return `Điểm thực hành: ${checkpoint.practiceScore}\n    <p>Điểm trắc nghiệm: ${checkpoint.checkpointScore}</p>`;
  }

  if (type === 'DEMO' && Array.isArray(value?.demoQuestions)) {
    const questions = value.demoQuestions as Array<Record<string, unknown>>;
    const total = questions.reduce((sum, question) => sum + (finiteNumber(question.score) || 0), 0);
    const details = questions
      .map((question) =>
        `<li>${escapeHtml(question.title)}: ${escapeHtml(question.score)} điểm</li>`,
      )
      .join('');
    return `<div><p><strong>${escapeHtml(areaName)}:</strong> <strong>${total} điểm</strong></p>${details ? `<ul>${details}</ul>` : ''}</div>`;
  }

  if (enteredContent) return normalizeSubmittedRichText(enteredContent);

  const grade = finiteNumber(value?.grade);
  return grade === undefined
    ? ''
    : `<p>${escapeHtml(areaName)}: ${grade} điểm</p>`;
}

function prepareCommentAreasForLms(
  areas: any[],
  values: any[],
): { ok: true; values: any[] } | { ok: false; message: string } {
  const areaById = new Map(areas.map((area) => [String(area?.id || ''), area]));
  const prepared = values.map((value) => {
    const area = areaById.get(String(value?.commentAreaId || ''));
    const type = normalizeStatus(value?.type);
    return {
      ...value,
      content: buildLmsAreaContent(area, value),
      ...(type === 'CHECKPOINT' && finiteNumber(value?.grade) === undefined ? { grade: 0 } : {}),
    };
  });

  const emptyValue = prepared.find((value) => !richTextToPlain(value.content));
  if (emptyValue) {
    const area = areaById.get(String(emptyValue.commentAreaId || ''));
    return {
      ok: false,
      message: `Vui lòng nhập nội dung cho tiêu chí “${String(area?.name || area?.fieldName || 'Nhận xét')}”.`,
    };
  }

  return { ok: true, values: prepared };
}

function buildCommentHtml(areas: any[], values: any[]): string {
  const areaById = new Map(areas.map((area) => [String(area.id), area]));
  const rows = values.map((value) => {
    const area = areaById.get(String(value.commentAreaId));
    const title = escapeHtml(area?.name || area?.fieldName || 'Nhận xét');
    if (value.type === 'CHECKPOINT' && value.checkpoint) {
      const questions = asAreaList(value.checkpoint.checkpointQuestions).map((question) =>
        `<li>${escapeHtml(question.title)}: ${question.result ? question.score : 0} điểm</li>`,
      ).join('');
      return `<li><strong>${title}</strong><div>Điểm thực hành: ${value.checkpoint.practiceScore}</div><div>Điểm checkpoint: ${value.checkpoint.checkpointScore}</div>${questions ? `<ul>${questions}</ul>` : ''}</li>`;
    }
    if (value.type === 'DEMO') {
      const details = asAreaList(value.demoQuestions).map((question) =>
        `<li>${escapeHtml(question.title)}: ${question.score}/${question.maxScore} điểm</li>`,
      ).join('');
      return `<li><strong>${title}</strong>${details ? `<ul>${details}</ul>` : ''}</li>`;
    }
    if (value.type === 'RATE') {
      const content = richTextToPlain(value.content);
      const renderedContent = content
        .split('\n')
        .filter(Boolean)
        .map((line) => `<div>${escapeHtml(line)}</div>`)
        .join('');
      return `<li><strong>${title}: ${escapeHtml(value.grade)} điểm</strong>${renderedContent}</li>`;
    }
    return `<li><strong>${title}</strong>${normalizeSubmittedRichText(String(value.content || ''))}</li>`;
  }).join('');
  return `<ul>${rows}</ul>`;
}

function normalizedAreaSnapshot(values: any[]): string {
  return JSON.stringify(
    values.map((value) => ({
      commentAreaId: String(value?.commentAreaId || ''),
      type: normalizeStatus(value?.type),
      content: normalizeSubmittedRichText(String(value?.content || '')).replace(/>\s+</g, '><'),
      grade: finiteNumber(value?.grade) ?? null,
      checkpoint: value?.checkpoint || null,
      demoQuestions: value?.demoQuestions || null,
    })).sort((left, right) => left.commentAreaId.localeCompare(right.commentAreaId)),
  );
}

function findSlot(cls: any, slotId: string): any | null {
  return (cls?.slots || []).find((slot: any) => String(slot?._id || '') === slotId) || null;
}

function findStudentAttendance(slot: any, studentId: string): any | null {
  return (slot?.studentAttendance || []).find(
    (attendance: any) => String(attendance?.student?.id || '') === studentId,
  ) || null;
}

function lessonMatches(slot: any, summary: string, homework: string): boolean {
  return richTextToPlain(slot?.summary) === richTextToPlain(summary)
    && richTextToPlain(slot?.homework) === richTextToPlain(homework);
}

function studentCommentMatches(slot: any, studentId: string, values: any[]): boolean {
  const attendance = findStudentAttendance(slot, studentId);
  if (!attendance) return false;
  return normalizedAreaSnapshot(asAreaList(attendance?.commentByAreas)) === normalizedAreaSnapshot(values);
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';
  if (!firebaseToken) {
    return NextResponse.json(
      { success: false, noLmsToken: true, message: 'Phiên TPS chưa có token LMS cá nhân.' },
      { status: 401 },
    );
  }

  const classId = safeIdentifier(request.nextUrl.searchParams.get('classId'));
  if (!classId) {
    return NextResponse.json({ success: false, message: 'Thiếu mã lớp.' }, { status: 400 });
  }

  const authHeader = `Bearer ${firebaseToken}`;
  const checkpointSlotId = safeIdentifier(request.nextUrl.searchParams.get('slotId'));
  const checkpointStudentId = safeIdentifier(request.nextUrl.searchParams.get('studentId'));

  if (checkpointSlotId && checkpointStudentId) {
    try {
      const result = await callLmsApi<any>({
        query: GET_STUDENT_CHECKPOINT_QUERY,
        operationName: 'FindOneStudentCheckpoint',
        variables: { payload: { sessionId: checkpointSlotId, studentId: checkpointStudentId } },
      }, authHeader);
      const checkpoint = result?.data?.findOneStudentCheckpoint || null;
      if (checkpoint && String(checkpoint.classId || '') !== classId) {
        return NextResponse.json({ success: false, message: 'Dữ liệu checkpoint không thuộc lớp này.' }, { status: 409 });
      }
      return NextResponse.json({ success: true, checkpoint });
    } catch (error) {
      console.warn('[nhan-xet-lop-hoc] Checkpoint lookup failed:', error);
      return NextResponse.json({
        success: true,
        checkpoint: null,
        message: 'Chưa đọc được điểm checkpoint từ LMS; giáo viên vẫn có thể nhập thủ công.',
      });
    }
  }

  try {
    const cls = await fetchCommentClass(classId, authHeader);
    if (!cls) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy lớp trên LMS.' }, { status: 404 });
    }
    const fallbackAreas = courseProcessForClass(cls) ? [] : await fetchFallbackAreas(authHeader);
    return NextResponse.json({
      success: true,
      class: mapCommentClass(cls, fallbackAreas, normalizeEmail(auth.sessionEmail)),
    });
  } catch (error: unknown) {
    console.error('[nhan-xet-lop-hoc] Load error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải dữ liệu nhận xét.' },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, message: 'Dữ liệu nhận xét quá lớn.' }, { status: 413 });
  }

  const firebaseToken = request.cookies.get('lms_firebase_token')?.value || '';
  if (!firebaseToken) {
    return NextResponse.json(
      { success: false, noLmsToken: true, message: 'Phiên TPS chưa có token LMS cá nhân.' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const action = body.action === 'lesson' || body.action === 'student' ? body.action : '';
  const classId = safeIdentifier(body.classId);
  const classSiteId = safeIdentifier(body.classSiteId);
  const slotId = safeIdentifier(body.slotId);
  const expectedStartTime = safeText(body.expectedStartTime, 100);
  const studentId = action === 'student' ? safeIdentifier(body.studentId) : '';
  const attendanceId = action === 'student' ? safeIdentifier(body.attendanceId) : '';
  const submittedAreas = action === 'student' ? parseSubmittedAreas(body.commentByAreas) : [];

  if (!action || !classId || !classSiteId || !slotId || (action === 'student' && (!studentId || !attendanceId || !submittedAreas))) {
    return NextResponse.json({ success: false, message: 'Thiếu hoặc sai định dạng dữ liệu nhận xét.' }, { status: 400 });
  }

  const writeKey = `${action}:${classId}:${classSiteId}:${slotId}:${studentId || 'lesson'}`;
  if (inFlightWrites.has(writeKey)) {
    return NextResponse.json(
      { success: false, message: 'Nội dung này đang được lưu. Vui lòng chờ kết quả hiện tại.' },
      { status: 409 },
    );
  }

  inFlightWrites.add(writeKey);
  const authHeader = `Bearer ${firebaseToken}`;
  const userEmail = normalizeEmail(auth.sessionEmail);

  try {
    const freshClass = await fetchCommentClass(classId, authHeader);
    if (!freshClass || String(freshClass.id || '') !== classId) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy lớp trên LMS.' }, { status: 404 });
    }
    if (normalizeStatus(freshClass.status) !== 'RUNNING') {
      return NextResponse.json({ success: false, message: 'Chỉ có thể nhận xét lớp đang Running.' }, { status: 409 });
    }

    const classSite = (freshClass.classSites || []).find(
      (site: any) => String(site?._id || '') === classSiteId,
    );
    const slot = findSlot(freshClass, slotId);
    if (!classSite || !slot) {
      return NextResponse.json(
        { success: false, message: 'Class site hoặc buổi học đã thay đổi trên LMS. Hãy tải lại.' },
        { status: 409 },
      );
    }
    if (!sameInstant(expectedStartTime, slot.startTime)) {
      return NextResponse.json(
        { success: false, message: 'Giờ học đã thay đổi trên LMS. Hãy tải lại trước khi nhận xét.' },
        { status: 409 },
      );
    }
    const startTime = slotTimestamp(slot);
    if (startTime === null || Date.now() < startTime) {
      return NextResponse.json(
        { success: false, message: 'Buổi học chưa bắt đầu nên chưa thể ghi nhận xét.' },
        { status: 409 },
      );
    }
    if (!canUpdateSlot(freshClass, classSite, slot, userEmail)) {
      return NextResponse.json(
        { success: false, message: 'Bạn không được phân công nhận xét ở buổi học hoặc class site này.' },
        { status: 403 },
      );
    }

    const slotIndex = sortedSlots(freshClass).findIndex(
      (candidate) => String(candidate?._id || '') === slotId,
    );
    const sessionNumber = Number(slot?.index) >= 0 ? Number(slot.index) + 1 : slotIndex + 1;
    let fallbackAreas: any[] = [];
    if (!courseProcessForClass(freshClass)) fallbackAreas = await fetchFallbackAreas(authHeader);
    const selection = areasForSession(freshClass, sessionNumber, fallbackAreas);
    const process = courseProcessForClass(freshClass);
    const slotContext = {
      slotType: lmsSlotType(selection.kind),
      courseProcessId: String(process?.id || freshClass?.courseProcessId || ''),
      ...(['NONE', 'DEFAULT', 'SPECIAL'].includes(selection.kind)
        ? { totalScore: null, rank: 'N/A' }
        : {}),
    };

    let payload: Record<string, unknown>;
    let verification: (verifiedSlot: any) => boolean;
    if (action === 'lesson') {
      const summary = safeText(body.summary, 20_000);
      const homework = safeText(body.homework, 20_000);
      if (lessonMatches(slot, summary, homework)) {
        return NextResponse.json({
          success: true,
          unchanged: true,
          message: 'Tổng kết và bài tập về nhà đã trùng với dữ liệu LMS.',
          class: mapCommentClass(freshClass, fallbackAreas, userEmail),
        });
      }
      const summaryHtml = editorTextToHtml(summary);
      const homeworkHtml = editorTextToHtml(homework);
      payload = {
        classId,
        slotId,
        classSiteId,
        sessionNumber,
        ...slotContext,
        summary: summaryHtml,
        homework: homeworkHtml,
      };
      verification = (verifiedSlot) => lessonMatches(verifiedSlot, summaryHtml, homeworkHtml);
    } else {
      const activeStudents = studentsForClassSite(freshClass, classSiteId);
      const belongsToSite = activeStudents.some(
        (row) => String(row?.student?.id || '') === studentId,
      );
      const attendance = findStudentAttendance(slot, studentId);
      if (!belongsToSite || !attendance || String(attendance?._id || '') !== attendanceId) {
        return NextResponse.json(
          { success: false, message: 'Học viên hoặc dữ liệu điểm danh đã thay đổi trên LMS. Hãy tải lại.' },
          { status: 409 },
        );
      }
      const attendanceStatus = normalizeStatus(attendance?.status);
      if (!attendanceStatus || attendanceStatus === 'NOT_RECORDED') {
        return NextResponse.json(
          { success: false, message: 'Cần điểm danh học viên trước khi viết nhận xét.' },
          { status: 409 },
        );
      }
      if (['ABSENT', 'ABSENT_WITH_NOTICE'].includes(attendanceStatus) && !selection.alwaysShow) {
        return NextResponse.json(
          { success: false, message: 'LMS không cho nhận xét học viên vắng ở buổi này.' },
          { status: 409 },
        );
      }
      const validation = validateAndDecorateAreas(submittedAreas || [], selection);
      if (!validation.ok) {
        return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
      }
      const values = validation.values;
      if (values.length === 0) {
        return NextResponse.json({ success: false, message: 'Hãy nhập ít nhất một nội dung nhận xét.' }, { status: 400 });
      }
      if (studentCommentMatches(slot, studentId, values)) {
        return NextResponse.json({
          success: true,
          unchanged: true,
          message: 'Nhận xét học viên đã trùng với dữ liệu LMS.',
          class: mapCommentClass(freshClass, fallbackAreas, userEmail),
        });
      }
      const preparedAreas = prepareCommentAreasForLms(selection.areas, values);
      if (!preparedAreas.ok) {
        return NextResponse.json({ success: false, message: preparedAreas.message }, { status: 400 });
      }
      const valuesForLms = preparedAreas.values;
      const combinedComment = buildCommentHtml(selection.areas, valuesForLms);
      payload = {
        classId,
        slotId,
        classSiteId,
        sessionNumber,
        ...slotContext,
        studentComment: {
          studentAttendanceId: attendanceId,
          studentId,
          content: combinedComment,
          // LMS expects CommentByAreaCommand[] directly at this field.
          byAreas: valuesForLms,
        },
      };
      verification = (verifiedSlot) => studentCommentMatches(verifiedSlot, studentId, valuesForLms);
    }

    let mutationError: LmsRequestError | null = null;
    try {
      await callLmsOnce({
        query: UPDATE_SLOT_COMMENT_MUTATION,
        operationName: 'UpdateSlotComment',
        variables: { payload },
      }, authHeader);
    } catch (error: unknown) {
      mutationError = error instanceof LmsRequestError
        ? error
        : new LmsRequestError('Không thể ghi nhận xét lên LMS.', 502, true);
    }

    let verifiedClass: any = null;
    try {
      verifiedClass = await fetchCommentClass(classId, authHeader);
    } catch (readbackError) {
      console.error('[nhan-xet-lop-hoc] LMS readback failed:', readbackError);
    }
    const verifiedSlot = verifiedClass ? findSlot(verifiedClass, slotId) : null;
    if (verifiedSlot && verification(verifiedSlot)) {
      const verifiedFallback = courseProcessForClass(verifiedClass) ? [] : fallbackAreas;
      return NextResponse.json({
        success: true,
        verified: true,
        message: mutationError
          ? 'LMS phản hồi không rõ ràng nhưng TPS đã đọc lại và xác nhận nhận xét được lưu.'
          : action === 'lesson'
            ? 'Đã lưu tổng kết và bài tập về nhà lên LMS.'
            : 'Đã lưu và xác nhận nhận xét học viên trên LMS.',
        class: mapCommentClass(verifiedClass, verifiedFallback, userEmail),
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
    console.error('[nhan-xet-lop-hoc] Save error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lưu nhận xét lên LMS.' },
      { status: 502 },
    );
  } finally {
    inFlightWrites.delete(writeKey);
  }
}
