import type { Metadata } from 'next'
import { LectureReviewRegistrationClient } from './LectureReviewRegistrationClient'

export const metadata: Metadata = {
  title: 'Đăng Ký Duyệt Giảng | TPS',
  description: 'Phiếu đăng ký duyệt giảng dành cho Leader và TE.',
}

export default function LectureReviewRegistrationPage() {
  return <LectureReviewRegistrationClient />
}
