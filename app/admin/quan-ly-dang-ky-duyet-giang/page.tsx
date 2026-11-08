import type { Metadata } from 'next'
import { LectureReviewManagementClient } from './LectureReviewManagementClient'

export const metadata: Metadata = {
  title: 'Quản Lý Đăng Ký Duyệt Giảng | TPS',
  description: 'Danh sách và bộ lọc phiếu đăng ký duyệt giảng.',
}

export default function LectureReviewManagementPage() {
  return <LectureReviewManagementClient />
}
