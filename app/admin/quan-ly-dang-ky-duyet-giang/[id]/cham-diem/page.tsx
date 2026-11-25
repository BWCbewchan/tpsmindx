import type { Metadata } from 'next'
import { LectureReviewScoringPageClient } from './LectureReviewScoringPageClient'

export const metadata: Metadata = {
  title: 'Chấm Điểm Duyệt Giảng Giáo Viên | TPS',
  description: 'Bảng đánh giá năng lực giảng dạy giáo viên MindX',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function LectureReviewScoringPage({ params }: PageProps) {
  const { id } = await params
  return <LectureReviewScoringPageClient applicationId={id} />
}
