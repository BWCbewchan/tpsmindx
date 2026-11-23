import { HC_ACCOUNT_EMAIL } from '@/lib/hc-operations-access'

export const LECTURE_REVIEW_CALENDAR_PATH = '/public/lich-duyet-giang'

const LECTURE_REVIEW_CALENDAR_EMAILS = new Set([
  HC_ACCOUNT_EMAIL,
  'ho@mindx.edu.vn',
  'so@mindx.edu.vn',
])

export function canAccessLectureReviewCalendar(email: unknown): boolean {
  return LECTURE_REVIEW_CALENDAR_EMAILS.has(
    String(email || '').trim().toLowerCase(),
  )
}

export function isLectureReviewCalendarPath(pathname: string): boolean {
  return (
    pathname === LECTURE_REVIEW_CALENDAR_PATH ||
    pathname.startsWith(`${LECTURE_REVIEW_CALENDAR_PATH}/`)
  )
}
