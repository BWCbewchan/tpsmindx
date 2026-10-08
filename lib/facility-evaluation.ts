export const FACILITY_EVALUATION_SCORE_VALUES = [1, 2, 3, 4, 5] as const

export const FACILITY_EVALUATION_CRITERIA = [
  {
    key: 'communication',
    label: 'Khả năng giao tiếp với cơ sở',
  },
  {
    key: 'problem_solving',
    label: 'Linh động xử lý vấn đề',
  },
  {
    key: 'workflow',
    label: 'Quy trình làm việc',
  },
  {
    key: 'class_teacher_quality',
    label: 'Chất lượng giáo viên lớp học',
  },
  {
    key: 'trial_teacher_quality',
    label: 'Chất lượng giáo viên trải nghiệm',
  },
] as const

export const FACILITY_EVALUATION_LEADER_ROLE_CODES = [
  'RL',
  'CL',
  'AL',
  'TC',
  'TE',
] as const

export const FACILITY_EVALUATION_RECIPIENT_ROLE_CODES = [
  'CM',
  'CSL',
] as const

export const FACILITY_EVALUATION_ALLOWED_ROLE_CODES = [
  'TEGL',
  'TM',
  'K12',
] as const

export type FacilityEvaluationCriterionKey =
  (typeof FACILITY_EVALUATION_CRITERIA)[number]['key']

export function convertFacilityScoreToTen(rawScore: number): number {
  return rawScore * 2
}

export function getVietnamMonthKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

export function formatVietnamMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const parsedMonth = Number(month)
  if (!year || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return monthKey
  }
  return `Tháng ${parsedMonth}/${year}`
}
