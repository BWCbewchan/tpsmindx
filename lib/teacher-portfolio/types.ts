export type TeacherPortfolioProvenance =
  | { kind: 'self_reported'; label: 'GV tự cập nhật' }
  | { kind: 'tps_synced'; label: 'Dữ liệu TPS' }
  | {
      kind: 'verified'
      label: 'Đã xác thực'
      verifiedAt: string | null
    }

export type TeacherPortfolioVerificationStatus =
  | 'self_declared'
  | 'pending'
  | 'verified'
  | 'rejected'

export type TeacherPortfolioEducation = {
  id: number
  institution: string
  qualification: string
  fieldOfStudy: string | null
  startYear: number | null
  endYear: number | null
  description: string | null
  provenance: TeacherPortfolioProvenance
}

export type TeacherPortfolioExperience = {
  id: number
  organization: string
  jobTitle: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  description: string | null
  provenance: TeacherPortfolioProvenance
}

export type TeacherPortfolioAchievement = {
  id: number
  category: 'award' | 'competition'
  title: string
  organization: string | null
  level: string | null
  achievedOn: string | null
  description: string | null
  evidenceUrl?: string | null
  verificationStatus: TeacherPortfolioVerificationStatus
  verificationNote?: string | null
  provenance: TeacherPortfolioProvenance
}

export type TeacherPortfolioCertificate = {
  id: number
  name: string
  type: string
  issueDate: string | null
  expiryDate: string | null
  description: string | null
  provenance: TeacherPortfolioProvenance
}

export type TeacherPortfolioTrainingSession = {
  id: number
  sessionNumber: number
  title: string
  sessionDate: string | null
  attendance: boolean
  score: number | null
}

export type TeacherPortfolioHonor = {
  id: number
  month: string | null
  title: string
  detail: string | null
  provenance: TeacherPortfolioProvenance
}

export type TeacherPortfolioDemoSection =
  | 'certificates'
  | 'onboarding'
  | 'internal_training'

export type TeacherPortfolioTemplate = 1 | 2 | 3 | 4

export type TeacherPortfolioDto = {
  meta: {
    slug: string
    sharePath: string
    createdAt: string
    updatedAt: string
    demoSections: TeacherPortfolioDemoSection[]
  }
  access: {
    mode: 'self' | 'shared'
    canEditSelfReported: boolean
    canVerifyAchievements: boolean
  }
  profile: {
    displayName: string
    professionalTitle: string
    centerName: string | null
    courseLines: string[]
    avatarUrl: string | null
  }
  education: TeacherPortfolioEducation[]
  experiences: TeacherPortfolioExperience[]
  achievements: TeacherPortfolioAchievement[]
  certificates: TeacherPortfolioCertificate[]
  training: {
    provenance: TeacherPortfolioProvenance
    onboarding: {
      available: boolean
      genName: string | null
      status: string | null
      sessions: TeacherPortfolioTrainingSession[]
    }
    internal: {
      available: boolean
      videosCompleted: number | null
      totalVideosAssigned: number | null
      averageVideoScore: number | null
      assignmentsPassed: number | null
      assignmentsTaken: number | null
      averageAssignmentScore: number | null
    }
    advanced: {
      available: boolean
      expertiseAverage: number | null
      expertiseRecords: number
      experienceAverage: number | null
      experienceRecords: number
    }
    media: Array<{
      id: number
      caption: string | null
      sessionTitle: string | null
    }>
  }
  operations: {
    provenance: TeacherPortfolioProvenance
    available: boolean
    periodLabel: string
    classCount: number | null
    studentCount: number | null
    classSessions: number | null
    teachingHours: number | null
    cpr: number | null
    retention: number | null
  }
  honors: TeacherPortfolioHonor[]
  studentAchievements: {
    available: boolean
    total: number | null
    provenance: TeacherPortfolioProvenance
  }
  sourceNotes: string[]
}

export type TeacherPortfolioEducationInput = {
  institution: string
  qualification: string
  fieldOfStudy?: string | null
  startYear?: number | null
  endYear?: number | null
  description?: string | null
}

export type TeacherPortfolioExperienceInput = {
  organization: string
  jobTitle: string
  startDate?: string | null
  endDate?: string | null
  isCurrent?: boolean
  description?: string | null
}

export type TeacherPortfolioAchievementInput = {
  id?: number
  category: 'award' | 'competition'
  title: string
  organization?: string | null
  level?: string | null
  achievedOn?: string | null
  description?: string | null
  evidenceUrl?: string | null
}

export type TeacherPortfolioUpdateInput = {
  education: TeacherPortfolioEducationInput[]
  experiences: TeacherPortfolioExperienceInput[]
  achievements: TeacherPortfolioAchievementInput[]
}

export type TeacherPortfolioApiResponse =
  | { success: true; data: TeacherPortfolioDto }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
