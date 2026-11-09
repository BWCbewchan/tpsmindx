export const LECTURE_REVIEW_CALENDAR_PATH = '/public/lich-duyet-giang'

const LECTURE_REVIEW_CALENDAR_EMAILS = new Set([
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
