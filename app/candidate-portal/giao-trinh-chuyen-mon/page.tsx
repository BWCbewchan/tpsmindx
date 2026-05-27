import { TeachingDocumentReadOnlyPage } from '@/components/teaching-documents/TeachingDocumentReadOnlyPage'

const PROFESSIONAL_SUBJECTS = ['Coding', 'Robotic', 'Art', 'E-Book'] as const

export default function CandidateGiaoTrinhChuyenMonPage() {
  return (
    <TeachingDocumentReadOnlyPage
      title="Giáo trình chuyên môn"
      description="Giáo trình môn học và E-Book đã ban hành"
      subjects={PROFESSIONAL_SUBJECTS}
      viewerBasePath="/candidate-portal/giao-trinh"
    />
  )
}
