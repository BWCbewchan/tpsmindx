import type {
  EvaluationAnswer,
  TeacherEvaluationChartRow,
  TeacherEvaluationClassSummary,
  TeacherEvaluationEntry,
} from '@/types/teacher-evaluation'
import { SHEET_HEADERS } from './constants'
import { extractSurveyScore, normalizeKey, round } from './normalize'

const TEACHER_QUESTION_TITLES = new Set([
  normalizeKey(SHEET_HEADERS.teacherUnderstandability),
  normalizeKey(SHEET_HEADERS.teacherAffinity),
])

function isTeacherGroup(group: string | undefined): boolean {
  const key = normalizeKey(group)
  return key === 'gv' || key.includes('teacher') || key.includes('giaovien') || key.includes('giangvien')
}

export function getTeacherScoreFromAnswers(answers: EvaluationAnswer[]): number | null {
  const groupedScores = answers
    .filter((answer) => isTeacherGroup(answer.group))
    .map((answer) => extractSurveyScore(answer.answer))
    .filter((score): score is number => score !== null)

  const scores = groupedScores.length > 0
    ? groupedScores
    : answers
      .filter((answer) => TEACHER_QUESTION_TITLES.has(normalizeKey(answer.title)))
      .map((answer) => extractSurveyScore(answer.answer))
      .filter((score): score is number => score !== null)

  if (scores.length === 0) return null
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

export function entryTimestamp(entry: TeacherEvaluationEntry): string | null {
  return entry.source === 'lms' ? entry.createdAt : entry.timestamp
}

export function responseIdentity(entry: TeacherEvaluationEntry): string {
  const classKey = normalizeKey(entry.classId || entry.className)
  const studentKey = normalizeKey(entry.studentId || entry.studentName)
  const dateKey = entryTimestamp(entry)?.slice(0, 10)
  if (!classKey || !studentKey || !dateKey) return `${entry.source}:${entry.id}`
  return `${classKey}:${studentKey}:${dateKey}`
}

function shouldReplaceDuplicate(
  current: TeacherEvaluationEntry,
  candidate: TeacherEvaluationEntry,
): boolean {
  if (current.teacherScore === null && candidate.teacherScore !== null) return true
  if (current.teacherScore !== null && candidate.teacherScore === null) return false
  return current.source === 'google_sheets' && candidate.source === 'lms'
}

export function deduplicateForAnalytics(
  entries: TeacherEvaluationEntry[],
): TeacherEvaluationEntry[] {
  const unique = new Map<string, TeacherEvaluationEntry>()
  for (const entry of entries) {
    const key = responseIdentity(entry)
    const current = unique.get(key)
    if (!current || shouldReplaceDuplicate(current, entry)) unique.set(key, entry)
  }
  return Array.from(unique.values())
}

export function teacherScoreAggregate(entries: TeacherEvaluationEntry[]): {
  total: number
  count: number
  average: number | null
} {
  const scores = entries
    .map((entry) => entry.teacherScore)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
  const total = scores.reduce((sum, score) => sum + score, 0)
  return {
    total,
    count: scores.length,
    average: scores.length > 0 ? total / scores.length : null,
  }
}

export function buildWeightedChartRows(
  summaries: TeacherEvaluationClassSummary[],
  keySelector: (summary: TeacherEvaluationClassSummary) => string,
): TeacherEvaluationChartRow[] {
  const groups = new Map<string, TeacherEvaluationClassSummary[]>()
  summaries.forEach((summary) => {
    const key = keySelector(summary) || 'Chưa xác định'
    groups.set(key, [...(groups.get(key) || []), summary])
  })

  return Array.from(groups.entries()).map(([name, rows]) => {
    const eligible = rows.reduce((sum, row) => sum + row.eligibleStudents, 0)
    const collected = rows.reduce((sum, row) => sum + row.collectedResponses, 0)
    const scoreTotal = rows.reduce((sum, row) => sum + row.teacherScoreTotal, 0)
    const scoredResponses = rows.reduce((sum, row) => sum + row.scoredResponseCount, 0)
    return {
      name,
      responses: rows.reduce((sum, row) => sum + row.analyticsResponseCount, 0),
      averageTeacherScore: round(scoredResponses > 0 ? scoreTotal / scoredResponses : null),
      collectionRate: round(eligible > 0 ? (collected / eligible) * 100 : null),
    }
  }).sort((first, second) => second.responses - first.responses || first.name.localeCompare(second.name, 'vi'))
}
