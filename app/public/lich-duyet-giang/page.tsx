import type { Metadata } from 'next'
import { LectureReviewPublicCalendar } from './LectureReviewPublicCalendar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Lịch duyệt giảng | MindX TPS',
  description: 'Lịch đăng ký duyệt giảng theo tháng của MindX',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PublicLectureReviewCalendarPage() {
  return <LectureReviewPublicCalendar />
}
