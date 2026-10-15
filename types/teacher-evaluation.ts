export type EvaluationSource = 'lms' | 'google_sheets'

export type SourceHealthStatus = 'ready' | 'empty' | 'unconfigured' | 'error'

export interface EvaluationCentre {
  id: string
  name: string
  shortName: string
}

export interface EvaluationAssignee {
  id: string
  username: string
  email: string
  displayName?: string
}

export interface EvaluationAnswer {
  questionId: string
  title: string
  description?: string
  group?: string
  answer: string
}

export interface EvaluationAttachment {
  fileName: string
  fileUrl: string
}

export interface EvaluationComment {
  id: string
  message: string
  createdAt: string | null
  userName: string
  userEmail: string
}

export interface LmsEvaluationTicket {
  source: 'lms'
  id: string
  mutationToken: string
  ticketCode: string
  title: string
  description: string
  priority: string
  feedbackTopic: string
  status: string
  deadline: string | null
  createdAt: string | null
  closedDate: string | null
  studentId: string
  studentName: string
  classId: string
  className: string
  centre: EvaluationCentre | null
  assignee: EvaluationAssignee | null
  answers: EvaluationAnswer[]
  attachments: EvaluationAttachment[]
  comments: EvaluationComment[]
  teacherScore: number | null
}

export interface GoogleSurveyResponse {
  source: 'google_sheets'
  id: string
  rowNumber: number
  timestamp: string | null
  rawTimestamp: string
  studentId: string
  studentName: string
  inputClassCode: string
  normalizedClassCode: string
  centerHint: string
  classId: string
  className: string
  centre: EvaluationCentre | null
  matchScore: number
  matchReasons: string[]
  matchMethod: 'direct' | 'inferred' | 'unmatched'
  teacherScore: number | null
  teacherUnderstandabilityScore: number | null
  teacherAffinityScore: number | null
  answers: EvaluationAnswer[]
}

export type TeacherEvaluationEntry = LmsEvaluationTicket | GoogleSurveyResponse

export interface SurveySessionStatus {
  sessionNumber: 4 | 8
  sessionId: string
  date: string
  classSurveyId?: string
  status?: string
  responseCount: number
  opened: boolean
}

export interface TeacherEvaluationClassSummary {
  classId: string
  className: string
  classStatus: string
  centre: EvaluationCentre | null
  courseName: string
  courseLineName: string
  teacherNames: string[]
  group: 'standard' | 'outside_session' | 'inactive'
  surveySessions: SurveySessionStatus[]
  eligibleStudents: number
  collectedResponses: number
  collectionRate: number | null
  teacherPointScore: number | null
  averageTeacherScore: number | null
  teacherScoreTotal: number
  scoredResponseCount: number
  analyticsResponseCount: number
  totalResponses: number
  lmsTicketCount: number
  googleResponseCount: number
  ticketStatuses: string[]
  feedbackTopics: string[]
}

export interface TeacherEvaluationChartRow {
  name: string
  responses: number
  averageTeacherScore: number | null
  collectionRate: number | null
}

export interface TeacherEvaluationStats {
  totalResponses: number
  lmsTicketCount: number
  googleResponseCount: number
  unmatchedGoogleCount: number
  averageTeacherScore: number | null
  surveyCollected: number
  surveyEligible: number
  collectionRate: number | null
  teacherPointScore: number | null
  openTicketCount: number
  resolvedTicketCount: number
  resolutionRate: number | null
  byCentre: TeacherEvaluationChartRow[]
  byCourse: TeacherEvaluationChartRow[]
}

export interface EvaluationSourceHealth {
  source: EvaluationSource
  status: SourceHealthStatus
  label: string
  message: string
  records: number
}

export interface TeacherEvaluationDashboardData {
  generatedAt: string
  dateFrom: string
  dateTo: string
  centres: EvaluationCentre[]
  entries: TeacherEvaluationEntry[]
  classes: TeacherEvaluationClassSummary[]
  stats: TeacherEvaluationStats
  sourceHealth: EvaluationSourceHealth[]
  warnings: string[]
}

export interface TeacherEvaluationApiResponse {
  success: boolean
  data?: TeacherEvaluationDashboardData
  error?: string
  noLmsToken?: boolean
  requestId?: string
}

export interface TeacherEvaluationFilterOptionsResponse {
  success: boolean
  centres?: EvaluationCentre[]
  error?: string
  noLmsToken?: boolean
}

export interface LmsAssigneeSearchResult extends EvaluationAssignee {
  centres: EvaluationCentre[]
}
