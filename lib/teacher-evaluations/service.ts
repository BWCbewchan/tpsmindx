import 'server-only'

import type {
  EvaluationAnswer,
  EvaluationCentre,
  EvaluationSourceHealth,
  GoogleSurveyResponse,
  LmsEvaluationTicket,
  TeacherEvaluationClassSummary,
  TeacherEvaluationDashboardData,
  TeacherEvaluationEntry,
} from '@/types/teacher-evaluation'
import {
  CLASS_INACTIVE_STATUSES,
  RESOLVED_TICKET_STATUSES,
  SHEET_HEADERS,
  SURVEY_DETAIL_QUESTIONS,
  TEACHER_POINT_SESSION_INDICES,
} from './constants'
import {
  buildWeightedChartRows,
  deduplicateForAnalytics,
  entryTimestamp,
  getTeacherScoreFromAnswers,
  teacherScoreAggregate,
} from './analytics'
import {
  fetchTeacherSurveySheet,
  getTeacherSurveyGoogleConfiguration,
} from './google-sheets'
import {
  fetchLmsClassSurveyStatuses,
  fetchLmsEvaluationClasses,
  fetchLmsTickets,
  type LmsCentre,
  type LmsClassSurveyStatus,
  type LmsEvaluationClass,
  type RawLmsTicket,
} from './lms'
import {
  centreMatchesHint,
  eligibleTeacherPointStudents,
  isTeacherPointEligibleClass,
  matchSheetRows,
  normalizeKey,
  parseDateInputBoundary,
  resolveRosterStudentId,
  round,
  sortSlotsByDate,
  teacherPointScore,
  toIsoDate,
  type SheetMatchResult,
} from './normalize'

export interface LoadTeacherEvaluationInput {
  authHeader: string
  dateFrom: string
  dateTo: string
  centres: LmsCentre[]
  allowUnscopedGoogleRows: boolean
  search?: string
  signal?: AbortSignal
  requestId?: string
}

const SOURCE_TIMEOUT_MS = 30000
const SURVEY_STATUS_TIMEOUT_MS = 20000

function boundedSignal(parent: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  return parent ? AbortSignal.any([parent, timeoutSignal]) : timeoutSignal
}

function resultSize(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length
  if (value instanceof Map) return value.size
  if (value && typeof value === 'object' && 'rows' in value) {
    const rows = (value as { rows?: unknown }).rows
    if (Array.isArray(rows)) return rows.length
  }
  return undefined
}

async function traceSource<T>(
  requestId: string,
  source: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  console.info(`[teacher-evaluations:${requestId}] ${source}:start`)
  try {
    const result = await operation()
    console.info(`[teacher-evaluations:${requestId}] ${source}:done`, {
      durationMs: Date.now() - startedAt,
      records: resultSize(result),
    })
    return result
  } catch (error) {
    console.warn(`[teacher-evaluations:${requestId}] ${source}:failed`, {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function toPublicCentre(centre?: Partial<LmsCentre> | null): EvaluationCentre | null {
  if (!centre?.id) return null
  return {
    id: centre.id,
    name: centre.name || centre.shortName || '',
    shortName: centre.shortName || centre.name || '',
  }
}

function findTicketCentre(
  ticket: RawLmsTicket,
  centres: LmsCentre[],
): EvaluationCentre | null {
  const sourceCentre = ticket.ticketSource?.centre
  if (sourceCentre?.id) {
    const canonical = centres.find((centre) => centre.id === sourceCentre.id)
    return toPublicCentre(canonical || {
      ...sourceCentre,
      name: sourceCentre.name || sourceCentre.shortName || '',
      shortName: sourceCentre.shortName || sourceCentre.name || '',
      isActive: true,
    })
  }
  return toPublicCentre(centres.find((centre) => centre.id === ticket.ticketSource?.centreId))
}

function extractLmsAnswers(ticket: RawLmsTicket): EvaluationAnswer[] {
  const answerMap = new Map(
    (ticket.ticketSource?.answers || []).map((answer) => [answer.questionId, String(answer.value ?? '')]),
  )
  return (ticket.ticketSource?.questions || []).map((question) => ({
    questionId: question.id,
    title: question.title || 'Câu hỏi',
    description: question.description,
    group: question.group,
    answer: answerMap.get(question.id) || '',
  }))
}

function mapLmsTicket(ticket: RawLmsTicket, centres: LmsCentre[]): LmsEvaluationTicket {
  const answers = extractLmsAnswers(ticket)
  return {
    source: 'lms',
    id: ticket.id,
    mutationToken: '',
    ticketCode: ticket.ticketCode || '',
    title: ticket.title || ticket.ticketCode || 'Phiếu đánh giá LMS',
    description: ticket.description || '',
    priority: ticket.priority || 'MEDIUM',
    feedbackTopic: ticket.feedbackTopic || 'OTHER',
    status: ticket.status || 'NEW',
    deadline: toIsoDate(ticket.deadline),
    createdAt: toIsoDate(ticket.createdAt),
    closedDate: toIsoDate(ticket.closedDate),
    studentId: ticket.ticketSource?.studentId || '',
    studentName: ticket.ticketSource?.studentName || 'Ẩn danh',
    classId: ticket.ticketSource?.classId || '',
    className: ticket.ticketSource?.className || '',
    centre: findTicketCentre(ticket, centres),
    assignee: ticket.assignee?.id ? {
      id: ticket.assignee.id,
      username: ticket.assignee.username || '',
      email: ticket.assignee.email || '',
      displayName: ticket.assignee.displayName,
    } : null,
    answers,
    attachments: (ticket.attachments || []).flatMap((attachment) =>
      attachment.fileUrl ? [{
        fileName: attachment.fileName || 'Tệp đính kèm',
        fileUrl: attachment.fileUrl,
      }] : [],
    ),
    comments: (ticket.comments || []).map((comment) => ({
      id: comment.id,
      message: comment.message || '',
      createdAt: toIsoDate(comment.createdAt),
      userName: comment.user?.displayName || comment.user?.username || comment.user?.email || '',
      userEmail: comment.user?.email || '',
    })),
    teacherScore: round(getTeacherScoreFromAnswers(answers)),
  }
}

function buildSheetAnswers(match: SheetMatchResult): EvaluationAnswer[] {
  const metadataHeaders = new Set<string>([
    SHEET_HEADERS.timestamp,
    SHEET_HEADERS.studentName,
    SHEET_HEADERS.classCode,
    SHEET_HEADERS.centreCode,
  ])
  const preferredQuestions = new Set<string>(SURVEY_DETAIL_QUESTIONS)
  const answerEntries = Object.entries(match.raw.values)
    .filter(([title, answer]) => !metadataHeaders.has(title) && Boolean(String(answer).trim()))
  answerEntries.sort(([firstTitle], [secondTitle]) => {
    const firstPreferred = preferredQuestions.has(firstTitle) ? 0 : 1
    const secondPreferred = preferredQuestions.has(secondTitle) ? 0 : 1
    return firstPreferred - secondPreferred
  })
  return answerEntries.map(([title, answer], index) => ({
    questionId: `sheet-${match.raw.rowNumber}-${index}`,
    title,
    answer: String(answer),
  }))
}

function mapGoogleResponse(
  match: SheetMatchResult,
  centres: LmsCentre[],
): GoogleSurveyResponse {
  const fallbackCentre = centres.find((centre) => centreMatchesHint(centre, [match.centerHint]))
  const centre = toPublicCentre(match.matchedClass?.centre || fallbackCentre)
  return {
    source: 'google_sheets',
    id: `sheet-row-${match.raw.rowNumber}`,
    rowNumber: match.raw.rowNumber,
    timestamp: match.rowDate?.toISOString() || null,
    rawTimestamp: match.timestamp,
    studentId: match.matchedClass
      ? resolveRosterStudentId(match.studentName, match.matchedClass)
      : '',
    studentName: match.studentName || 'Ẩn danh',
    inputClassCode: match.inputClassCode,
    normalizedClassCode: match.normalizedClassCode,
    centerHint: match.centerHint,
    classId: match.matchedClass?.id || '',
    className: match.matchedClass?.className || match.matchedClass?.name || match.normalizedClassCode,
    centre,
    matchScore: match.matchScore,
    matchReasons: match.matchReasons,
    matchMethod: match.matchMethod,
    teacherScore: round(match.teacherScore),
    teacherUnderstandabilityScore: match.teacherUnderstandabilityScore,
    teacherAffinityScore: match.teacherAffinityScore,
    answers: buildSheetAnswers(match),
  }
}

function entryMatchesClass(
  entry: TeacherEvaluationEntry,
  currentClass: LmsEvaluationClass,
): boolean {
  if (entry.classId && entry.classId === currentClass.id) return true
  const classNameKey = normalizeKey(currentClass.name)
  if (!classNameKey || normalizeKey(entry.className) !== classNameKey) return false
  return !entry.centre?.id || !currentClass.centre?.id || entry.centre.id === currentClass.centre.id
}

function entriesForClass(
  entries: TeacherEvaluationEntry[],
  currentClass: LmsEvaluationClass,
): TeacherEvaluationEntry[] {
  return entries.filter((entry) => entryMatchesClass(entry, currentClass))
}

function collectTeacherNames(currentClass: LmsEvaluationClass, relevantSlots: ReturnType<typeof sortSlotsByDate>): string[] {
  const names = new Set<string>()
  relevantSlots.forEach((slot) => {
    slot.teachers?.forEach((teacher) => {
      if (teacher.isActive !== false && teacher.teacher?.fullName) names.add(teacher.teacher.fullName)
    })
  })
  currentClass.teachers?.forEach((teacher) => {
    if (teacher.isActive !== false && teacher.teacher?.fullName) names.add(teacher.teacher.fullName)
  })
  return Array.from(names)
}

function buildClassSummaries(input: {
  classes: LmsEvaluationClass[]
  entries: TeacherEvaluationEntry[]
  analyticsEntries: TeacherEvaluationEntry[]
  googleMatches: SheetMatchResult[]
  surveyStatuses: Map<string, LmsClassSurveyStatus>
  rangeStart: Date
  rangeEnd: Date
}): TeacherEvaluationClassSummary[] {
  const summaries = input.classes.flatMap((currentClass): TeacherEvaluationClassSummary[] => {
    const slots = sortSlotsByDate(currentClass.slots)
    const surveySlots = TEACHER_POINT_SESSION_INDICES.flatMap((slotIndex) => {
      const slot = slots[slotIndex]
      if (!slot?._id || !slot.date) return []
      const slotDate = new Date(slot.date)
      if (Number.isNaN(slotDate.getTime()) || slotDate < input.rangeStart || slotDate > input.rangeEnd) return []
      const sessionNumber = (slotIndex + 1) as 4 | 8
      const status = input.surveyStatuses.get(`${currentClass.id}:${slot._id}`)
      return [{
        sessionNumber,
        sessionId: slot._id,
        date: slotDate.toISOString(),
        classSurveyId: status?.classSurveyId,
        status: status?.status,
        responseCount: status?.responseCount || 0,
        opened: status?.opened || false,
      }]
    })
    const classEntries = entriesForClass(input.entries, currentClass)
    const analyticsEntries = entriesForClass(input.analyticsEntries, currentClass)
    if (surveySlots.length === 0 && classEntries.length === 0) return []

    const eligible = isTeacherPointEligibleClass(currentClass, input.rangeStart, input.rangeEnd)
      ? eligibleTeacherPointStudents(currentClass)
      : []
    const eligibleStudentIds = new Set(eligible.flatMap((student) => {
      if (student.student?.id) return [student.student.id]
      const studentNameKey = normalizeKey(student.student?.fullName)
      return studentNameKey ? [`sheet:${studentNameKey}`] : []
    }))
    const collected = new Set<string>()
    input.googleMatches.forEach((row) => {
      if (row.matchedClass?.id !== currentClass.id) return
      const studentId = resolveRosterStudentId(row.studentName, currentClass)
      if (eligibleStudentIds.has(studentId)) collected.add(studentId)
    })
    const collectedResponses = Math.min(collected.size, eligible.length)
    const collectionRate = eligible.length > 0 ? (collectedResponses / eligible.length) * 100 : null
    const relevantSlots = TEACHER_POINT_SESSION_INDICES.flatMap((index) => slots[index] ? [slots[index]] : [])
    const score = teacherScoreAggregate(analyticsEntries)
    const lmsEntries = classEntries.filter((entry): entry is LmsEvaluationTicket => entry.source === 'lms')
    const inactive = CLASS_INACTIVE_STATUSES.has(currentClass.status?.toUpperCase() || '')

    return [{
      classId: currentClass.id,
      className: currentClass.name,
      classStatus: currentClass.status || '',
      centre: toPublicCentre(currentClass.centre),
      courseName: currentClass.course?.name || currentClass.course?.shortName || 'Chưa xác định',
      courseLineName: currentClass.course?.courseLine?.name || 'Chưa xác định',
      teacherNames: collectTeacherNames(currentClass, relevantSlots),
      group: inactive ? 'inactive' : surveySlots.length > 0 ? 'standard' : 'outside_session',
      surveySessions: surveySlots,
      eligibleStudents: eligible.length,
      collectedResponses,
      collectionRate: round(collectionRate),
      teacherPointScore: teacherPointScore(collectionRate),
      averageTeacherScore: round(score.average),
      teacherScoreTotal: score.total,
      scoredResponseCount: score.count,
      analyticsResponseCount: analyticsEntries.length,
      totalResponses: classEntries.length,
      lmsTicketCount: lmsEntries.length,
      googleResponseCount: classEntries.filter((entry) => entry.source === 'google_sheets').length,
      ticketStatuses: Array.from(new Set(lmsEntries.map((entry) => entry.status))).sort(),
      feedbackTopics: Array.from(new Set(lmsEntries.map((entry) => entry.feedbackTopic))).sort(),
    }]
  })

  const unmatchedEntries = input.entries.filter((entry) =>
    !input.classes.some((currentClass) => entryMatchesClass(entry, currentClass)),
  )
  const unmatchedGroups = new Map<string, TeacherEvaluationEntry[]>()
  unmatchedEntries.forEach((entry) => {
    const key = entry.classId
      ? `id:${entry.classId}`
      : `name:${normalizeKey(entry.className) || `${entry.source}:${entry.id}`}`
    unmatchedGroups.set(key, [...(unmatchedGroups.get(key) || []), entry])
  })

  unmatchedGroups.forEach((classEntries, key) => {
    const first = classEntries[0]
    const analyticsEntries = input.analyticsEntries.filter((entry) => {
      if (first.classId) return entry.classId === first.classId
      return normalizeKey(entry.className) === normalizeKey(first.className)
    })
    const score = teacherScoreAggregate(analyticsEntries)
    const lmsEntries = classEntries.filter((entry): entry is LmsEvaluationTicket => entry.source === 'lms')
    summaries.push({
      classId: first.classId || `unmatched:${key}`,
      className: first.className || 'Chưa xác định lớp',
      classStatus: '',
      centre: classEntries.find((entry) => entry.centre)?.centre || null,
      courseName: 'Chưa xác định',
      courseLineName: 'Chưa xác định',
      teacherNames: [],
      group: 'outside_session',
      surveySessions: [],
      eligibleStudents: 0,
      collectedResponses: 0,
      collectionRate: null,
      teacherPointScore: null,
      averageTeacherScore: round(score.average),
      teacherScoreTotal: score.total,
      scoredResponseCount: score.count,
      analyticsResponseCount: analyticsEntries.length,
      totalResponses: classEntries.length,
      lmsTicketCount: lmsEntries.length,
      googleResponseCount: classEntries.filter((entry) => entry.source === 'google_sheets').length,
      ticketStatuses: Array.from(new Set(lmsEntries.map((entry) => entry.status))).sort(),
      feedbackTopics: Array.from(new Set(lmsEntries.map((entry) => entry.feedbackTopic))).sort(),
    })
  })

  return summaries.sort((first, second) => {
    const rateDifference = (first.collectionRate ?? -1) - (second.collectionRate ?? -1)
    return rateDifference || first.className.localeCompare(second.className, 'vi')
  })
}

function sourceErrorMessage(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message : String(reason || '')
  return message ? `${fallback}: ${message}` : fallback
}

export async function loadTeacherEvaluationDashboard(
  input: LoadTeacherEvaluationInput,
): Promise<TeacherEvaluationDashboardData> {
  const requestId = input.requestId || 'unknown'
  const startedAt = Date.now()
  const rangeStart = parseDateInputBoundary(input.dateFrom)
  const rangeEnd = parseDateInputBoundary(input.dateTo, true)
  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
    throw new Error('Khoảng ngày không hợp lệ.')
  }

  const centreIds = input.centres.map((centre) => centre.id)
  const [ticketsResult, classesResult, sheetResult] = await Promise.allSettled([
    traceSource(requestId, 'lms-tickets', () => fetchLmsTickets(input.authHeader, {
      centreIds,
      dateFromIso: rangeStart.toISOString(),
      dateToIso: rangeEnd.toISOString(),
      search: input.search,
      signal: boundedSignal(input.signal, SOURCE_TIMEOUT_MS),
    })),
    traceSource(requestId, 'lms-classes', () => fetchLmsEvaluationClasses(input.authHeader, {
      centreIds,
      dateFromIso: rangeStart.toISOString(),
      dateToIso: rangeEnd.toISOString(),
      search: input.search,
      signal: boundedSignal(input.signal, SOURCE_TIMEOUT_MS),
    })),
    traceSource(requestId, 'google-sheet', () => fetchTeacherSurveySheet({
      from: rangeStart,
      to: rangeEnd,
      signal: boundedSignal(input.signal, SOURCE_TIMEOUT_MS),
    })),
  ])

  const warnings: string[] = []
  const tickets = ticketsResult.status === 'fulfilled' ? ticketsResult.value : []
  const classes = classesResult.status === 'fulfilled' ? classesResult.value : []
  if (ticketsResult.status === 'rejected') {
    warnings.push(sourceErrorMessage(ticketsResult.reason, 'Không tải được phiếu LMS'))
  }
  if (classesResult.status === 'rejected') {
    warnings.push(sourceErrorMessage(classesResult.reason, 'Không tải được danh sách lớp LMS'))
  }

  const sheetData = sheetResult.status === 'fulfilled'
    ? sheetResult.value
    : {
        rows: [],
        totalRowsScanned: 0,
        boundedRange: null,
        missingHeaders: [],
        warnings: [],
        dateOrder: 'MDY' as const,
      }
  if (sheetResult.status === 'rejected') {
    warnings.push(sourceErrorMessage(sheetResult.reason, 'Không tải được Google Sheet'))
  } else {
    console.info(`[teacher-evaluations:${requestId}] google-sheets:parsed`, {
      rows: sheetData.rows.length,
      totalRowsScanned: sheetData.totalRowsScanned,
      boundedRange: sheetData.boundedRange,
      dateOrder: sheetData.dateOrder,
    })
  }
  warnings.push(...sheetData.warnings)

  const initialMatches = matchSheetRows(sheetData.rows, classes, sheetData.dateOrder)
  const allowedCentreIds = new Set(centreIds)
  const searchKey = normalizeKey(input.search)
  const googleMatches = initialMatches.filter((match) => {
    if (searchKey && !normalizeKey([
      match.studentName,
      match.inputClassCode,
      match.normalizedClassCode,
      match.centerHint,
      match.matchedClass?.name,
    ].join(' ')).includes(searchKey)) return false
    if (input.allowUnscopedGoogleRows) return true
    if (match.matchedClass?.centre?.id) return allowedCentreIds.has(match.matchedClass.centre.id)
    return input.centres.some((centre) => centreMatchesHint(centre, [match.centerHint]))
  })

  const lmsEntries = tickets.map((ticket) => mapLmsTicket(ticket, input.centres))
  const googleEntries = googleMatches.map((match) => mapGoogleResponse(match, input.centres))
  const entries: TeacherEvaluationEntry[] = [...lmsEntries, ...googleEntries]
    .sort((first, second) => {
      const firstTime = entryTimestamp(first) ? new Date(entryTimestamp(first) as string).getTime() : 0
      const secondTime = entryTimestamp(second) ? new Date(entryTimestamp(second) as string).getTime() : 0
      return secondTime - firstTime
    })
  const analyticsEntries = deduplicateForAnalytics(entries)

  const surveyLookupInputs = classes.flatMap((currentClass) => {
    const slots = sortSlotsByDate(currentClass.slots)
    return TEACHER_POINT_SESSION_INDICES.flatMap((slotIndex) => {
      const slot = slots[slotIndex]
      if (!slot?._id || !slot.date) return []
      const slotDate = new Date(slot.date)
      if (Number.isNaN(slotDate.getTime()) || slotDate < rangeStart || slotDate > rangeEnd) return []
      return [{
        classId: currentClass.id,
        sessionId: slot._id,
        sessionNumber: (slotIndex + 1) as 4 | 8,
      }]
    })
  })
  let surveyStatuses = new Map<string, LmsClassSurveyStatus>()
  if (surveyLookupInputs.length > 0) {
    try {
      surveyStatuses = await traceSource(requestId, 'lms-survey-statuses', () =>
        fetchLmsClassSurveyStatuses(input.authHeader, surveyLookupInputs, {
          signal: boundedSignal(input.signal, SURVEY_STATUS_TIMEOUT_MS),
        }))
    } catch (error) {
      warnings.push(sourceErrorMessage(error, 'Không đối soát được trạng thái mở form buổi 4/8'))
    }
  }

  const classSummaries = buildClassSummaries({
    classes,
    entries,
    analyticsEntries,
    googleMatches,
    surveyStatuses,
    rangeStart,
    rangeEnd,
  })
  const surveyEligible = classSummaries.reduce((sum, summary) => sum + summary.eligibleStudents, 0)
  const surveyCollected = classSummaries.reduce((sum, summary) => sum + summary.collectedResponses, 0)
  const collectionRate = surveyEligible > 0 ? (surveyCollected / surveyEligible) * 100 : null
  const resolvedTicketCount = lmsEntries.filter((entry) => RESOLVED_TICKET_STATUSES.has(entry.status.toUpperCase())).length
  const openTicketCount = lmsEntries.length - resolvedTicketCount
  const analysisSummaries = classSummaries.filter((summary) => summary.group !== 'inactive')
  const overallScore = teacherScoreAggregate(analyticsEntries)

  const googleConfiguration = getTeacherSurveyGoogleConfiguration()
  const sourceHealth: EvaluationSourceHealth[] = [
    {
      source: 'lms',
      status: ticketsResult.status === 'rejected' && classesResult.status === 'rejected'
        ? 'error'
        : lmsEntries.length === 0 && classes.length === 0 ? 'empty' : 'ready',
      label: 'LMS',
      message: ticketsResult.status === 'rejected' || classesResult.status === 'rejected'
        ? 'LMS chỉ tải được một phần dữ liệu.'
        : `Đã tải ${lmsEntries.length} phiếu và ${classes.length} lớp.`,
      records: lmsEntries.length,
    },
    {
      source: 'google_sheets',
      status: !googleConfiguration.configured
        ? 'unconfigured'
        : sheetResult.status === 'rejected' ? 'error' : googleEntries.length === 0 ? 'empty' : 'ready',
      label: 'Google Forms',
      message: !googleConfiguration.configured
        ? googleConfiguration.message
        : sheetResult.status === 'rejected'
          ? 'Không kết nối được Google Sheet.'
          : `Đã tải ${googleEntries.length} phản hồi trong phạm vi được phép.`,
      records: googleEntries.length,
    },
  ]

  console.info(`[teacher-evaluations:${requestId}] dashboard:done`, {
    durationMs: Date.now() - startedAt,
    centres: input.centres.length,
    classes: classSummaries.length,
    entries: entries.length,
    warnings: warnings.length,
  })

  return {
    generatedAt: new Date().toISOString(),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    centres: input.centres.map((centre) => toPublicCentre(centre) as EvaluationCentre),
    entries,
    classes: classSummaries,
    stats: {
      totalResponses: analyticsEntries.length,
      lmsTicketCount: lmsEntries.length,
      googleResponseCount: googleEntries.length,
      unmatchedGoogleCount: googleMatches.filter((match) => !match.matchedClass).length,
      averageTeacherScore: round(overallScore.average),
      surveyCollected,
      surveyEligible,
      collectionRate: round(collectionRate),
      teacherPointScore: teacherPointScore(collectionRate),
      openTicketCount,
      resolvedTicketCount,
      resolutionRate: round(lmsEntries.length > 0 ? (resolvedTicketCount / lmsEntries.length) * 100 : null),
      byCentre: buildWeightedChartRows(analysisSummaries, (summary) => summary.centre?.shortName || summary.centre?.name || 'Chưa rõ'),
      byCourse: buildWeightedChartRows(analysisSummaries, (summary) => summary.courseLineName || summary.courseName),
    },
    sourceHealth,
    warnings: Array.from(new Set(warnings)),
  }
}
