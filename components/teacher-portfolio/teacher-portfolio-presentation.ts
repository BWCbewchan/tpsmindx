import type {
  TeacherPortfolioCertificate,
  TeacherPortfolioDto,
  TeacherPortfolioTrainingSession,
} from '@/lib/teacher-portfolio/types'

export function formatTeacherPortfolioDate(value: string | null): string {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function teacherPortfolioInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function resolveTeacherPortfolioPresentation(
  data: TeacherPortfolioDto,
  demoMode: boolean,
) {
  const training = data.training
  const accountDemoSections = new Set(data.meta.demoSections)

  const demoCertificates = accountDemoSections.has('certificates') || (demoMode && data.certificates.length === 0)
  const mockCertificates: TeacherPortfolioCertificate[] = [
    {
      id: -101,
      name: 'Phương pháp giảng dạy tích cực',
      type: 'Nghiệp vụ sư phạm',
      issueDate: '2025-06-18',
      expiryDate: null,
      description: 'Năng lực tổ chức lớp học và thúc đẩy sự chủ động của học viên.',
      provenance: { kind: 'self_reported', label: 'GV tự cập nhật' },
    },
    {
      id: -102,
      name: 'Ứng dụng AI trong giáo dục',
      type: 'Công nghệ giáo dục',
      issueDate: '2026-02-12',
      expiryDate: null,
      description: 'Ứng dụng công cụ AI để thiết kế học liệu và cá nhân hóa hoạt động học tập.',
      provenance: { kind: 'self_reported', label: 'GV tự cập nhật' },
    },
  ]
  const certificates = data.certificates.length > 0 ? data.certificates : demoCertificates ? mockCertificates : []

  const demoOnboarding = accountDemoSections.has('onboarding') || (demoMode && training.onboarding.sessions.length === 0)
  const mockOnboarding: TeacherPortfolioTrainingSession[] = [
    { id: -1, sessionNumber: 1, title: 'Văn hóa & phương pháp giáo dục MindX', sessionDate: '2026-08-18', attendance: true, score: 9.1 },
    { id: -2, sessionNumber: 2, title: 'Quản lý lớp học tích cực', sessionDate: '2026-08-20', attendance: true, score: 8.8 },
    { id: -3, sessionNumber: 3, title: 'Thực hành giảng dạy', sessionDate: '2026-08-22', attendance: true, score: 9.2 },
  ]
  const onboardingSessions = training.onboarding.sessions.length > 0
    ? training.onboarding.sessions
    : demoOnboarding
      ? mockOnboarding
      : []

  const hasInternalTrainingData = [
    training.internal.totalVideosAssigned,
    training.internal.videosCompleted,
    training.internal.assignmentsTaken,
    training.internal.assignmentsPassed,
    training.internal.averageVideoScore,
    training.internal.averageAssignmentScore,
  ].some((value) => (value ?? 0) > 0)
  const demoInternalTraining = accountDemoSections.has('internal_training') || (demoMode && !hasInternalTrainingData)
  const internalTraining = demoInternalTraining && !hasInternalTrainingData
    ? {
        available: true,
        videosCompleted: 8,
        totalVideosAssigned: 10,
        averageVideoScore: 8.7,
        assignmentsPassed: 4,
        assignmentsTaken: 5,
        averageAssignmentScore: 8.5,
      }
    : training.internal

  const demoAdvancedTraining = demoMode && !training.advanced.available
  const advancedTraining = demoAdvancedTraining
    ? {
        available: true,
        expertiseAverage: 8.8,
        expertiseRecords: 3,
        experienceAverage: 9.1,
        experienceRecords: 2,
      }
    : training.advanced

  const demoMedia = demoMode && training.media.length === 0
  const trainingMedia = demoMedia
    ? [
        { id: -1, caption: 'Thực hành quản lý lớp học', sessionTitle: 'Training đầu vào · Buổi 01' },
        { id: -2, caption: 'Micro-teaching cùng chuyên gia', sessionTitle: 'Training đầu vào · Buổi 02' },
        { id: -3, caption: 'Thảo luận phương pháp giảng dạy', sessionTitle: 'Training chuyên sâu' },
      ]
    : training.media

  const displayOperations = {
    classCount: data.operations.classCount ?? (demoMode ? 8 : null),
    studentCount: data.operations.studentCount ?? (demoMode ? 112 : null),
    classSessions: data.operations.classSessions ?? (demoMode ? 96 : null),
    teachingHours: data.operations.teachingHours ?? (demoMode ? 144 : null),
  }
  const demoOperations = demoMode && [
    data.operations.classCount,
    data.operations.studentCount,
    data.operations.classSessions,
    data.operations.teachingHours,
  ].some((value) => value === null)

  const demoStudentAwards = demoMode && !data.studentAchievements.available
    ? [
        { title: 'Giải Nhì bảng Sáng tạo trẻ', competition: 'WRO Vietnam 2026', result: '02 học viên được hướng dẫn' },
        { title: 'Top 10 dự án tiềm năng', competition: 'MindX Innovation Challenge', result: '01 đội học viên' },
      ]
    : []

  const hasBackground = data.education.length > 0 || data.experiences.length > 0
  const hasCredentials = certificates.length > 0 || data.achievements.length > 0
  const hasOperations = Object.values(displayOperations).some((value) => value !== null)
  const trainingColumnCount = [
    onboardingSessions.length > 0,
    internalTraining.available,
    advancedTraining.available,
  ].filter(Boolean).length
  const hasTraining = trainingColumnCount > 0 || trainingMedia.length > 0
  const hasStudentAchievements = data.studentAchievements.available || demoStudentAwards.length > 0
  const hasJourney = hasOperations || data.honors.length > 0 || hasStudentAchievements
  const hasDemoContent = demoMode || accountDemoSections.size > 0
  const trainingCompletion = internalTraining.totalVideosAssigned && internalTraining.videosCompleted !== null
    ? Math.round((internalTraining.videosCompleted / internalTraining.totalVideosAssigned) * 100)
    : null

  const sections = [
    { id: 'profile', label: 'Hồ sơ chuyên môn' },
    ...(hasBackground ? [{ id: 'background', label: 'Nền tảng nghề nghiệp' }] : []),
    ...(hasCredentials ? [{ id: 'credentials', label: 'Chứng chỉ & thành tích' }] : []),
    ...(hasTraining ? [{ id: 'training', label: 'Đào tạo tại MindX' }] : []),
    ...(hasJourney ? [{ id: 'journey', label: 'Hành trình giảng dạy' }] : []),
  ]

  return {
    certificates,
    onboardingSessions,
    internalTraining,
    advancedTraining,
    trainingMedia,
    displayOperations,
    demoCertificates,
    demoOnboarding,
    demoInternalTraining,
    demoAdvancedTraining,
    demoMedia,
    demoOperations,
    demoStudentAwards,
    hasBackground,
    hasCredentials,
    hasOperations,
    hasTraining,
    hasStudentAchievements,
    hasJourney,
    hasDemoContent,
    trainingCompletion,
    sections,
  }
}

export type TeacherPortfolioPresentation = ReturnType<typeof resolveTeacherPortfolioPresentation>
