import { TeachingDocumentReadOnlyPage } from '@/components/teaching-documents/TeachingDocumentReadOnlyPage'

const EXPERIENCE_SUBJECTS = ['Trải nghiệm'] as const

export default function CandidateGiaoTrinhTraiNghiemPage() {
  return (
    <TeachingDocumentReadOnlyPage
      title="Giáo trình trải nghiệm"
      description="Giáo trình trải nghiệm đã ban hành"
      subjects={EXPERIENCE_SUBJECTS}
      viewerBasePath="/candidate-portal/giao-trinh"
    />
  )
}
