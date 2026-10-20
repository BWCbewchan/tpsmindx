import 'server-only'

import {
  callLmsApi,
  callLmsApiAllowPartialWithOptions,
  callLmsApiWithOptions,
} from '@/lib/lms-api'
import type { LmsAssigneeSearchResult } from '@/types/teacher-evaluation'
import { STUDENT_TEACHING_SURVEY_ID } from './constants'
import type { MatchableClass, MatchableCentre, MatchableSlot } from './normalize'

export interface LmsCentre extends MatchableCentre {
  isActive: boolean
}

export interface RawLmsTicketQuestion {
  id: string
  title: string
  description?: string
  type?: string
  isRequired?: boolean
  group?: string
}

export interface RawLmsTicket {
  id: string
  ticketCode?: string
  title?: string
  description?: string
  priority?: string
  feedbackTopic?: string
  status?: string
  deadline?: string | number
  createdAt?: string | number
  closedDate?: string | number
  assignee?: {
    id: string
    username?: string
    email?: string
    displayName?: string
  }
  ticketSource?: {
    id?: string
    channel?: string
    classId?: string
    surveyResponseId?: string
    studentName?: string
    studentId?: string
    className?: string
    centreId?: string
    questions?: RawLmsTicketQuestion[]
    answers?: Array<{ questionId: string; value: string }>
    centre?: { id: string; name?: string; shortName?: string }
  }
  attachments?: Array<{ fileName?: string; fileUrl?: string }>
  comments?: Array<{
    id: string
    message?: string
    createdAt?: string | number
    user?: { username?: string; email?: string; displayName?: string }
  }>
}

export interface LmsEvaluationClass extends MatchableClass {
  status?: string
  startDate?: string
  endDate?: string
  course?: {
    id?: string
    name?: string
    shortName?: string
    courseLine?: { id?: string; name?: string }
  } | null
  centre?: LmsCentre | null
  teachers?: Array<{
    isActive?: boolean
    teacher?: { id?: string; fullName?: string }
    role?: { shortName?: string }
  }>
  slots?: MatchableSlot[]
}

export interface LmsClassSurveyStatus {
  classId: string
  sessionId: string
  sessionNumber: 4 | 8
  surveyId: string
  classSurveyId?: string
  target?: string
  status?: string
  responseCount: number
  opened: boolean
}

export interface LmsTicketUpdate {
  id: string
  title?: string
  description?: string
  priority?: string
  feedbackTopic?: string
  status?: string
  assigneeId?: string
}

const GET_CENTRES_QUERY = /* GraphQL */ `
  query getCentres(
    $search: String
    $isActive: Boolean
    $pageIndex: Int!
    $itemsPerPage: Int!
    $orderBy: String
  ) {
    centres(
      payload: {
        filter_textSearch: $search
        isActive_eq: $isActive
        pageIndex: $pageIndex
        itemsPerPage: $itemsPerPage
        orderBy: $orderBy
      }
    ) {
      data { id shortName name isActive }
      pagination { total }
    }
  }
`

const FIND_TICKETS_QUERY = /* GraphQL */ `
  query FindTicketPaginate($payload: TicketQuery) {
    findTicketPaginate(payload: $payload) {
      data {
        id
        ticketCode
        title
        description
        priority
        feedbackTopic
        status
        deadline
        assignee { id username email displayName }
        ticketSource {
          id
          channel
          classId
          surveyResponseId
          studentName
          studentId
          className
          centreId
          questions { id title description type isRequired group }
          answers { questionId value }
          centre { id name shortName }
        }
        attachments { fileName fileUrl }
        comments {
          id
          message
          createdAt
          user { username email displayName }
        }
        createdAt
        closedDate
      }
      pagination { total }
    }
  }
`

const GET_CLASSES_QUERY = /* GraphQL */ `
  query GetTeacherEvaluationClasses(
    $search: String
    $centres: [String]
    $haveSlotIn: HaveSlotIn
    $pageIndex: Int!
    $itemsPerPage: Int!
    $orderBy: String
  ) {
    classes(
      payload: {
        filter_textSearch: $search
        centre_in: $centres
        haveSlot_in: $haveSlotIn
        pageIndex: $pageIndex
        itemsPerPage: $itemsPerPage
        orderBy: $orderBy
      }
    ) {
      data {
        id
        name
        status
        startDate
        endDate
        course { id name shortName courseLine { id name } }
        centre { id name shortName isActive }
        teachers {
          isActive
          teacher { id fullName }
          role { shortName }
        }
        students {
          _id
          activeInClass
          student { id fullName }
          completionInfo { status reason }
        }
        slots {
          _id
          date
          teachers {
            isActive
            teacher { id fullName }
          }
          studentAttendance { student { id } }
        }
      }
      pagination { total }
    }
  }
`

const UPDATE_TICKET_MUTATION = /* GraphQL */ `
  mutation TicketCommand($payload: UpdateTicketCommand!) {
    ticket {
      update(payload: $payload) {
        id
        ticketCode
        title
        description
        priority
        feedbackTopic
        status
        deadline
        assignee { id username email displayName }
        createdAt
        closedDate
      }
    }
  }
`

const SEARCH_USERS_QUERY = /* GraphQL */ `
  query getUsers(
    $search: String
    $isActive: Boolean
    $pageIndex: Int!
    $itemsPerPage: Int!
    $orderBy: String
  ) {
    users(
      payload: {
        filter_textSearch: $search
        isActive_equals: $isActive
        pageIndex: $pageIndex
        itemsPerPage: $itemsPerPage
        orderBy: $orderBy
      }
    ) {
      data {
        id
        username
        email
        displayName
        centres { id shortName name }
      }
      pagination { total }
    }
  }
`

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (values.length === 0) return []
  const results = new Array<R>(values.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(values[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

export async function fetchLmsCentres(
  authHeader: string,
  options: { signal?: AbortSignal } = {},
): Promise<LmsCentre[]> {
  const pageSize = 100
  const fetchPage = (pageIndex: number) => callLmsApiWithOptions<{
    data: { centres: { data: LmsCentre[]; pagination: { total: number } } }
  }>({
    query: GET_CENTRES_QUERY,
    operationName: 'getCentres',
    variables: { search: '', isActive: true, pageIndex, itemsPerPage: pageSize, orderBy: 'name_asc' },
  }, authHeader, options)

  const first = await fetchPage(0)
  const firstPage = first.data.centres
  const remainingIndexes = Array.from(
    { length: Math.max(0, Math.ceil(firstPage.pagination.total / pageSize) - 1) },
    (_, index) => index + 1,
  )
  const remaining = await mapWithConcurrency(remainingIndexes, 3, fetchPage)
  return [firstPage.data, ...remaining.map((response) => response.data.centres.data)].flat()
}

export async function fetchLmsTickets(
  authHeader: string,
  input: {
    centreIds: string[]
    dateFromIso: string
    dateToIso: string
    search?: string
    signal?: AbortSignal
  },
): Promise<RawLmsTicket[]> {
  const pageSize = 100
  const payload = {
    pageIndex: 0,
    itemsPerPage: pageSize,
    assignee_in: [],
    centreId_in: input.centreIds,
    feedbackTopic_in: [],
    status_in: [],
    channel_in: [],
    filter_textSearch: input.search || '',
    deadline_gte: '',
    deadline_lte: '',
    createdAt_gte: input.dateFromIso,
    createdAt_lte: input.dateToIso,
  }
  const fetchPage = (pageIndex: number) => callLmsApiWithOptions<{
    data: { findTicketPaginate: { data: RawLmsTicket[]; pagination: { total: number } } }
  }>({
    query: FIND_TICKETS_QUERY,
    operationName: 'FindTicketPaginate',
    variables: { payload: { ...payload, pageIndex } },
  }, authHeader, { signal: input.signal })

  const first = await fetchPage(0)
  const firstPage = first.data.findTicketPaginate
  const remainingIndexes = Array.from(
    { length: Math.max(0, Math.ceil(firstPage.pagination.total / pageSize) - 1) },
    (_, index) => index + 1,
  )
  const remaining = await mapWithConcurrency(remainingIndexes, 4, fetchPage)
  return [firstPage.data, ...remaining.map((response) => response.data.findTicketPaginate.data)].flat()
}

export async function fetchLmsEvaluationClasses(
  authHeader: string,
  input: {
    centreIds: string[]
    dateFromIso: string
    dateToIso: string
    search?: string
    signal?: AbortSignal
  },
): Promise<LmsEvaluationClass[]> {
  const pageSize = 100
  const base = {
    search: input.search || '',
    centres: input.centreIds,
    haveSlotIn: { from: input.dateFromIso, to: input.dateToIso },
    itemsPerPage: pageSize,
    orderBy: 'createdAt_desc',
  }
  const fetchPage = (pageIndex: number) => callLmsApiWithOptions<{
    data: { classes: { data: LmsEvaluationClass[]; pagination: { total: number } } }
  }>({
    query: GET_CLASSES_QUERY,
    operationName: 'GetTeacherEvaluationClasses',
    variables: { ...base, pageIndex },
  }, authHeader, { signal: input.signal })

  const first = await fetchPage(0)
  const firstPage = first.data.classes
  const remainingIndexes = Array.from(
    { length: Math.max(0, Math.ceil(firstPage.pagination.total / pageSize) - 1) },
    (_, index) => index + 1,
  )
  const remaining = await mapWithConcurrency(remainingIndexes, 4, fetchPage)
  return [firstPage.data, ...remaining.map((response) => response.data.classes.data)].flat()
}

export async function fetchLmsClassSurveyStatuses(
  authHeader: string,
  inputs: Array<{ classId: string; sessionId: string; sessionNumber: 4 | 8 }>,
  options: { signal?: AbortSignal } = {},
): Promise<Map<string, LmsClassSurveyStatus>> {
  const uniqueInputs = Array.from(new Map(
    inputs.map((input) => [`${input.classId}:${input.sessionId}`, input]),
  ).values())
  const batches: typeof uniqueInputs[] = []
  for (let offset = 0; offset < uniqueInputs.length; offset += 35) {
    batches.push(uniqueInputs.slice(offset, offset + 35))
  }

  const batchResults = await Promise.all(batches.map(async (batch) => {
    if (options.signal?.aborted) return []
    try {
      const variableDefinitions = batch
        .map((_, index) => `$payload${index}: FindOneClassSurveyInput!`)
        .join(', ')
      const fields = batch.map((_, index) => `
        s${index}: findOneClassSurvey(payload: $payload${index}) {
          id classId sessionId surveyId target responses status
        }
      `).join('\n')
      const variables = Object.fromEntries(batch.map((input, index) => [
        `payload${index}`,
        {
          classId: input.classId,
          sessionId: input.sessionId,
          surveyId: STUDENT_TEACHING_SURVEY_ID,
          target: 'STUDENT',
        },
      ]))
      const response = await callLmsApiAllowPartialWithOptions<{
        data?: Record<string, {
          id?: string
          classId?: string
          sessionId?: string
          surveyId?: string
          target?: string
          responses?: string[]
          status?: string
        } | null>
      }>({
        query: `query FindStudentClassSurveys(${variableDefinitions}) { ${fields} }`,
        operationName: 'FindStudentClassSurveys',
        variables,
      }, authHeader, options)

      return batch.map((input, index): LmsClassSurveyStatus => {
        const survey = response.data?.[`s${index}`]
        const status = survey?.status?.toUpperCase()
        return {
          ...input,
          surveyId: survey?.surveyId || STUDENT_TEACHING_SURVEY_ID,
          classSurveyId: survey?.id,
          target: survey?.target,
          status: survey?.status,
          responseCount: survey?.responses?.length || 0,
          opened: Boolean(survey && status !== 'CREATED'),
        }
      })
    } catch (error) {
      console.warn('[teacher-evaluations] Failed to load a survey status batch', {
        size: batch.length,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }))

  return new Map(batchResults.flat().map((status) => [
    `${status.classId}:${status.sessionId}`,
    status,
  ]))
}

export async function updateLmsTicket(
  authHeader: string,
  update: LmsTicketUpdate,
): Promise<RawLmsTicket> {
  const payload: Record<string, unknown> = { id: update.id }
  if (update.title !== undefined) payload.title = update.title
  if (update.description !== undefined) payload.description = update.description
  if (update.priority !== undefined) payload.priority = update.priority
  if (update.feedbackTopic !== undefined) payload.feedbackTopic = update.feedbackTopic
  if (update.status !== undefined) payload.status = update.status
  if (update.assigneeId !== undefined) payload.asigneeId = update.assigneeId
  const response = await callLmsApi<{ data: { ticket: { update: RawLmsTicket } } }>({
    query: UPDATE_TICKET_MUTATION,
    operationName: 'TicketCommand',
    variables: { payload },
  }, authHeader)
  return response.data.ticket.update
}

export async function searchLmsAssignees(
  authHeader: string,
  search: string,
): Promise<LmsAssigneeSearchResult[]> {
  const response = await callLmsApi<{
    data: {
      users: {
        data: Array<{
          id: string
          username?: string
          email?: string
          displayName?: string
          centres?: Array<{ id: string; name?: string; shortName?: string }>
        }>
      }
    }
  }>({
    query: SEARCH_USERS_QUERY,
    operationName: 'getUsers',
    variables: { search, isActive: true, pageIndex: 0, itemsPerPage: 25, orderBy: 'createdAt_desc' },
  }, authHeader)
  return response.data.users.data.map((user) => ({
    id: user.id,
    username: user.username || '',
    email: user.email || '',
    displayName: user.displayName || user.username || user.email || '',
    centres: (user.centres || []).map((centre) => ({
      id: centre.id,
      name: centre.name || centre.shortName || '',
      shortName: centre.shortName || centre.name || '',
    })),
  }))
}

export { mapWithConcurrency }
