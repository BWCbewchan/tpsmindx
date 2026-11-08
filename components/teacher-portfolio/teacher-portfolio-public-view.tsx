import {
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Medal,
  Presentation,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import Image from 'next/image'

import { PortfolioMobileMenu } from '@/components/student-portfolio/portfolio-mobile-menu'
import { PortfolioPdfDownloadButton } from '@/components/student-portfolio/portfolio-pdf-download-button'
import { TeacherPortfolioCaseStudyView } from '@/components/teacher-portfolio/teacher-portfolio-case-study-view'
import { TeacherPortfolioCreativeView } from '@/components/teacher-portfolio/teacher-portfolio-creative-view'
import { TeacherPortfolioProgressRail } from '@/components/teacher-portfolio/teacher-portfolio-progress-rail'
import { resolveTeacherPortfolioPresentation } from '@/components/teacher-portfolio/teacher-portfolio-presentation'
import { TeacherPortfolioSwissGridView } from '@/components/teacher-portfolio/teacher-portfolio-swiss-grid-view'
import type { TeacherPortfolioDto, TeacherPortfolioTemplate } from '@/lib/teacher-portfolio/types'
import logoTechAi from '@/logo_tech_ai_trong_suot.png'
import { AchievementReviewControls } from './achievement-review-controls'

function formatDate(value: string | null): string {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function DemoBadge() {
  return (
    <span className="inline-flex border border-[#d8b66c] bg-[#f7e7bd] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#6c4800]">
      Dữ liệu minh họa
    </span>
  )
}

function SectionTitle({
  number,
  eyebrow,
  title,
  description,
  inverse = false,
}: {
  number: string
  eyebrow: string
  title: string
  description: string
  inverse?: boolean
}) {
  return (
    <div className={`mb-12 border-t pt-6 ${inverse ? 'border-white/25' : 'border-[#bfb5a9]'}`}>
      <div className="grid gap-5 md:grid-cols-[160px_1fr] md:gap-10">
        <p className={`text-xs font-black uppercase tracking-[0.19em] ${inverse ? 'text-[#efc46e]' : 'text-[#bd0026]'}`}>
          {number} · {eyebrow}
        </p>
        <div>
          <h2 className={`max-w-3xl text-3xl font-black leading-[1.08] tracking-[-0.04em] sm:text-5xl ${inverse ? 'text-white' : 'text-[#171512]'}`}>
            {title}
          </h2>
          <p className={`mt-4 max-w-2xl text-sm leading-7 ${inverse ? 'text-white/62' : 'text-[#6b625a]'}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

function SubsectionHeading({
  icon: Icon,
  children,
  inverse = false,
}: {
  icon: typeof GraduationCap
  children: React.ReactNode
  inverse?: boolean
}) {
  return (
    <div className={`flex w-full items-center gap-3 border-b pb-4 ${inverse ? 'border-white/20' : 'border-[#d8d0c6]'}`}>
      <Icon className={`h-5 w-5 ${inverse ? 'text-[#efc46e]' : 'text-[#bd0026]'}`} />
      <h3 className={`text-sm font-black uppercase tracking-[0.12em] ${inverse ? 'text-white' : 'text-[#26221e]'}`}>
        {children}
      </h3>
    </div>
  )
}

export function TeacherPortfolioPublicView({
  data,
  demoMode = false,
  template = 1,
}: {
  data: TeacherPortfolioDto
  demoMode?: boolean
  template?: TeacherPortfolioTemplate
}) {
  const presentation = resolveTeacherPortfolioPresentation(data, demoMode)
  if (template === 2) {
    return <TeacherPortfolioCreativeView data={data} demoMode={demoMode} presentation={presentation} />
  }
  if (template === 3) {
    return <TeacherPortfolioCaseStudyView data={data} demoMode={demoMode} presentation={presentation} />
  }
  if (template === 4) {
    return <TeacherPortfolioSwissGridView data={data} demoMode={demoMode} presentation={presentation} />
  }

  const operations = data.operations
  const training = data.training
  const accountDemoSections = new Set(data.meta.demoSections)

  const demoCertificates = accountDemoSections.has('certificates') || (demoMode && data.certificates.length === 0)
  const certificates = data.certificates.length > 0
    ? data.certificates
    : demoCertificates
      ? [
          { id: -101, name: 'Phương pháp giảng dạy tích cực', type: 'Nghiệp vụ sư phạm', issueDate: '2025-06-18' },
          { id: -102, name: 'Ứng dụng AI trong giáo dục', type: 'Công nghệ giáo dục', issueDate: '2026-02-12' },
        ]
      : []

  const demoOnboarding = accountDemoSections.has('onboarding') || (demoMode && training.onboarding.sessions.length === 0)
  const onboardingSessions = training.onboarding.sessions.length > 0
    ? training.onboarding.sessions
    : demoOnboarding
      ? [
          { id: -1, sessionNumber: 1, title: 'Văn hóa & phương pháp giáo dục MindX', sessionDate: '2026-08-18', attendance: true, score: 9.1 },
          { id: -2, sessionNumber: 2, title: 'Quản lý lớp học tích cực', sessionDate: '2026-08-20', attendance: true, score: 8.8 },
          { id: -3, sessionNumber: 3, title: 'Thực hành giảng dạy', sessionDate: '2026-08-22', attendance: true, score: 9.2 },
        ]
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
    classCount: operations.classCount ?? (demoMode ? 8 : null),
    studentCount: operations.studentCount ?? (demoMode ? 112 : null),
    classSessions: operations.classSessions ?? (demoMode ? 96 : null),
    teachingHours: operations.teachingHours ?? (demoMode ? 144 : null),
  }
  const demoOperations = demoMode && [
    operations.classCount,
    operations.studentCount,
    operations.classSessions,
    operations.teachingHours,
  ].some((value) => value === null)
  const hasOperations = Object.values(displayOperations).some((value) => value !== null)

  const demoStudentAwards = demoMode && !data.studentAchievements.available
    ? [
        { title: 'Giải Nhì bảng Sáng tạo trẻ', competition: 'WRO Vietnam 2026', result: '02 học viên được hướng dẫn' },
        { title: 'Top 10 dự án tiềm năng', competition: 'MindX Innovation Challenge', result: '01 đội học viên' },
      ]
    : []

  const hasBackground = data.education.length > 0 || data.experiences.length > 0
  const hasCredentials = certificates.length > 0 || data.achievements.length > 0
  const trainingColumnCount = [
    onboardingSessions.length > 0,
    internalTraining.available,
    advancedTraining.available,
  ].filter(Boolean).length
  const hasTraining = trainingColumnCount > 0 || trainingMedia.length > 0
  const hasStudentAchievements = data.studentAchievements.available || demoStudentAwards.length > 0
  const hasJourney = hasOperations || data.honors.length > 0 || hasStudentAchievements
  const hasDemoContent = demoMode || accountDemoSections.size > 0

  const sections = [
    { id: 'profile', label: 'Hồ sơ chuyên môn' },
    ...(hasBackground ? [{ id: 'background', label: 'Nền tảng nghề nghiệp' }] : []),
    ...(hasCredentials ? [{ id: 'credentials', label: 'Chứng chỉ & thành tích' }] : []),
    ...(hasTraining ? [{ id: 'training', label: 'Đào tạo tại MindX' }] : []),
    ...(hasJourney ? [{ id: 'journey', label: 'Hành trình giảng dạy' }] : []),
  ]

  const trainingCompletion = internalTraining.totalVideosAssigned && internalTraining.videosCompleted !== null
    ? Math.round((internalTraining.videosCompleted / internalTraining.totalVideosAssigned) * 100)
    : null

  const summaryStats = [
    { value: displayOperations.classCount ?? '—', label: 'Lớp đã giảng dạy' },
    { value: displayOperations.studentCount ?? '—', label: 'Học viên đồng hành' },
    { value: displayOperations.classSessions ?? '—', label: 'Buổi giảng dạy' },
    { value: displayOperations.teachingHours !== null ? `${displayOperations.teachingHours}h` : '—', label: 'Giờ giảng dạy' },
  ]

  const trainingGridClass = trainingColumnCount >= 3
    ? 'lg:grid-cols-3'
    : trainingColumnCount === 2
      ? 'lg:grid-cols-2'
      : 'lg:grid-cols-1'

  return (
    <main className="portfolio-theme min-h-screen bg-[#f7f4ee] text-[#171512]">
      <TeacherPortfolioProgressRail sections={sections} themeColor="#bd0026" />

      <header className="sticky top-0 z-30 border-b border-[#d8d0c6] bg-[#f7f4ee]/95 px-4 py-3 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a href="#profile" className="flex min-w-0 items-center gap-3">
            <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-9 w-auto shrink-0 object-contain sm:h-11" priority />
            <span className="h-8 w-px shrink-0 bg-[#cfc6ba]" aria-hidden="true" />
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#423c36] sm:text-xs">
              Hồ sơ giáo viên
            </p>
          </a>

          <nav className="hidden items-center gap-6 xl:flex" aria-label="Điều hướng portfolio">
            {sections.slice(1).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="border-b border-transparent pb-1 text-[11px] font-bold text-[#696159] transition-colors hover:border-[#bd0026] hover:text-[#bd0026]"
              >
                {section.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <PortfolioPdfDownloadButton />
            <PortfolioMobileMenu sections={sections} themeColor="#bd0026" />
          </div>
        </div>
      </header>

      {hasDemoContent ? (
        <div className="border-b border-[#d8b66c] bg-[#f7e7bd] px-4 py-2.5 text-center text-[11px] font-bold leading-5 text-[#684500] print:hidden">
          {demoMode
            ? 'Bản trình bày · Những mục chưa có dữ liệu thật đang dùng dữ liệu minh họa để duyệt giao diện.'
            : 'Tài khoản trình bày · Chứng chỉ và dữ liệu đào tạo được đánh dấu minh họa chưa phải dữ liệu vận hành thật.'}
        </div>
      ) : null}

      <section id="profile" className="scroll-mt-20 overflow-hidden">
        <div className="mx-auto grid min-h-[620px] max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)] lg:gap-16">
          <div className="relative z-10">
            <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#bd0026]">
              <span>Teacher Portfolio</span>
              <span className="h-px w-12 bg-[#bd0026]" aria-hidden="true" />
              <span className="text-[#746d65]">MindX</span>
            </div>

            <h1 className="mt-10 max-w-4xl text-balance text-[clamp(3.35rem,8vw,6.4rem)] font-black leading-[0.92] tracking-[-0.065em] text-[#171512]">
              {data.profile.displayName}
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-semibold leading-8 text-[#4f4841] sm:text-2xl sm:leading-9">
              {data.profile.professionalTitle}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#bfb5a9] pt-5 text-sm font-semibold text-[#655d55]">
              {data.profile.centerName ? (
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#bd0026]" />
                  {data.profile.centerName}
                </span>
              ) : null}
              {data.profile.courseLines.map((course) => (
                <span key={course} className="relative pl-4 before:absolute before:left-0 before:top-1/2 before:h-1 before:w-1 before:-translate-y-1/2 before:bg-[#bd0026]">
                  {course}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[410px] lg:mx-0 lg:justify-self-end">
            <div className="absolute -left-3 top-8 h-[72%] w-3 bg-[#bd0026]" aria-hidden="true" />
            <div className="relative aspect-[4/5] overflow-hidden border border-[#bfb5a9] bg-[#e6ded3]">
              {data.profile.avatarUrl ? (
                <Image
                  src={data.profile.avatarUrl}
                  alt={`Ảnh đại diện ${data.profile.displayName}`}
                  fill
                  sizes="(max-width: 1024px) 90vw, 410px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="grid h-full place-items-center bg-[#bd0026] text-7xl font-black tracking-[-0.08em] text-white">
                  {initials(data.profile.displayName)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-5 right-0 border border-[#171512] bg-[#f7f4ee] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#171512]">
              Hồ sơ chuyên môn
            </div>
          </div>
        </div>
      </section>

      {hasOperations ? (
        <section className="border-y border-[#bfb5a9] bg-[#fbfaf7]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            {demoOperations ? <div className="flex justify-end pt-4"><DemoBadge /></div> : null}
            <div className="grid grid-cols-2 md:grid-cols-4">
              {summaryStats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`px-4 py-7 sm:px-6 sm:py-9 ${index % 2 === 1 ? 'border-l border-[#d8d0c6]' : ''} ${index > 1 ? 'border-t border-[#d8d0c6] md:border-t-0' : ''} ${index > 0 ? 'md:border-l md:border-[#d8d0c6]' : ''} md:px-7`}
                >
                  <p className="text-3xl font-black tracking-[-0.04em] text-[#171512] sm:text-4xl">{stat.value}</p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#776f67]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasBackground ? (
        <section id="background" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <SectionTitle
            number="01"
            eyebrow="Trước MindX"
            title="Nền tảng học vấn & kinh nghiệm."
            description="Nền tảng chuyên môn và những trải nghiệm nghề nghiệp tạo nên cách giáo viên đồng hành cùng học viên."
          />

          <div className={`grid gap-12 ${data.education.length > 0 && data.experiences.length > 0 ? 'lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#d8d0c6]' : ''}`}>
            {data.education.length > 0 ? (
              <div className={data.experiences.length > 0 ? 'lg:pr-12' : ''}>
                <SubsectionHeading icon={GraduationCap}>Học vấn</SubsectionHeading>
                <div>
                  {data.education.map((item) => (
                    <article key={item.id} className="border-b border-[#d8d0c6] py-7">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
                        <div>
                          <h4 className="text-lg font-black tracking-[-0.02em] text-[#211e1a]">{item.institution}</h4>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#5f574f]">
                            {item.qualification}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}
                          </p>
                        </div>
                        {item.startYear || item.endYear ? (
                          <p className="text-xs font-black tabular-nums text-[#857c73]">
                            {item.startYear || '—'}—{item.endYear || 'Nay'}
                          </p>
                        ) : null}
                      </div>
                      {item.description ? <p className="mt-4 max-w-xl text-sm leading-7 text-[#70675f]">{item.description}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {data.experiences.length > 0 ? (
              <div className={data.education.length > 0 ? 'lg:pl-12' : ''}>
                <SubsectionHeading icon={BriefcaseBusiness}>Kinh nghiệm làm việc</SubsectionHeading>
                <div>
                  {data.experiences.map((item) => (
                    <article key={item.id} className="border-b border-[#d8d0c6] py-7">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
                        <div>
                          <h4 className="text-lg font-black tracking-[-0.02em] text-[#211e1a]">{item.jobTitle}</h4>
                          <p className="mt-2 text-sm font-semibold text-[#5f574f]">{item.organization}</p>
                        </div>
                        <p className="text-xs font-black tabular-nums text-[#857c73]">
                          {formatDate(item.startDate)}—{item.isCurrent ? 'Hiện tại' : formatDate(item.endDate)}
                        </p>
                      </div>
                      {item.description ? <p className="mt-4 max-w-xl text-sm leading-7 text-[#70675f]">{item.description}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasCredentials ? (
        <section id="credentials" className="scroll-mt-24 bg-[#171512] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionTitle
              number="02"
              eyebrow="Năng lực"
              title="Chứng chỉ & dấu ấn cá nhân."
              description="Các cột mốc chuyên môn được trình bày như một hồ sơ năng lực ngắn gọn, tập trung vào nội dung và thời điểm."
              inverse
            />

            <div className={`grid gap-14 ${certificates.length > 0 && data.achievements.length > 0 ? 'lg:grid-cols-2 lg:gap-16' : ''}`}>
              {certificates.length > 0 ? (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <SubsectionHeading icon={ShieldCheck} inverse>Chứng chỉ</SubsectionHeading>
                    {demoCertificates ? <DemoBadge /> : null}
                  </div>
                  <div>
                    {certificates.map((item, index) => (
                      <article key={item.id} className="grid grid-cols-[36px_1fr] gap-4 border-b border-white/18 py-6">
                        <p className="pt-1 text-[10px] font-black tabular-nums text-[#efc46e]">{String(index + 1).padStart(2, '0')}</p>
                        <div>
                          <h4 className="text-lg font-black tracking-[-0.02em]">{item.name}</h4>
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-white/48">{item.type}</p>
                          {item.issueDate ? <p className="mt-4 text-xs text-white/55">Cấp ngày {formatDate(item.issueDate)}</p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.achievements.length > 0 ? (
                <div>
                  <SubsectionHeading icon={Medal} inverse>Giải thưởng & cuộc thi</SubsectionHeading>
                  <div>
                    {data.achievements.map((item, index) => (
                      <article key={item.id} className="grid grid-cols-[36px_1fr] gap-4 border-b border-white/18 py-6">
                        <p className="pt-1 text-[10px] font-black tabular-nums text-[#efc46e]">{String(index + 1).padStart(2, '0')}</p>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#efc46e]">
                            {item.category === 'competition' ? 'Cuộc thi' : 'Giải thưởng'}
                          </p>
                          <h4 className="mt-2 text-lg font-black tracking-[-0.02em]">{item.title}</h4>
                          <p className="mt-2 text-sm text-white/55">{[item.organization, item.level].filter(Boolean).join(' · ')}</p>
                          {item.description ? <p className="mt-4 text-sm leading-7 text-white/62">{item.description}</p> : null}
                          {data.access.canVerifyAchievements && item.verificationStatus === 'pending' ? (
                            <AchievementReviewControls achievementId={item.id} evidenceUrl={item.evidenceUrl} />
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {hasTraining ? (
        <section id="training" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <SectionTitle
            number="03"
            eyebrow="Tại MindX"
            title="Quá trình đào tạo nội bộ."
            description="Hành trình đào tạo được tổ chức theo từng giai đoạn, từ đầu vào đến các bài kiểm tra chuyên sâu."
          />

          {trainingColumnCount > 0 ? (
            <div className={`grid border-y border-[#bfb5a9] ${trainingGridClass} lg:divide-x lg:divide-[#d8d0c6]`}>
              {onboardingSessions.length > 0 ? (
                <article className="py-7 lg:px-7 lg:first:pl-0">
                  <div className="flex items-start justify-between gap-4">
                    <CalendarDays className="h-6 w-6 text-[#bd0026]" />
                    {demoOnboarding ? <DemoBadge /> : null}
                  </div>
                  <h3 className="mt-7 text-xl font-black tracking-[-0.025em]">Đào tạo đầu vào</h3>
                  <p className="mt-2 text-sm text-[#70675f]">
                    {training.onboarding.genName || (demoOnboarding ? 'Gen Teacher Onboarding 2026' : 'Chưa xác định Gen')}
                  </p>
                  <div className="mt-7">
                    {onboardingSessions.map((session) => (
                      <div key={session.id} className="grid grid-cols-[26px_1fr] gap-3 border-t border-[#d8d0c6] py-4">
                        <span className="pt-0.5 text-xs font-black tabular-nums text-[#bd0026]">
                          {String(session.sessionNumber).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="text-sm font-bold leading-6">{session.title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#82786e]">
                            {session.attendance ? <CheckCircle2 className="h-3.5 w-3.5 text-[#267052]" /> : null}
                            <span>{session.sessionDate ? formatDate(session.sessionDate) : 'Chưa có lịch'}</span>
                            {session.score !== null ? <span>· {session.score} điểm</span> : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {internalTraining.available ? (
                <article className="border-t border-[#d8d0c6] py-7 lg:border-t-0 lg:px-7">
                  <div className="flex items-start justify-between gap-4">
                    <BookOpenCheck className="h-6 w-6 text-[#bd0026]" />
                    {demoInternalTraining ? <DemoBadge /> : null}
                  </div>
                  <h3 className="mt-7 text-xl font-black tracking-[-0.025em]">Training nội bộ</h3>
                  {trainingCompletion !== null ? (
                    <div className="mt-5">
                      <div className="flex items-end justify-between gap-3">
                        <p className="text-xs font-bold text-[#70675f]">Tiến độ video</p>
                        <p className="text-2xl font-black tabular-nums">{trainingCompletion}%</p>
                      </div>
                      <div className="mt-3 h-1 bg-[#d8d0c6]">
                        <div className="h-full bg-[#bd0026]" style={{ width: `${Math.min(100, trainingCompletion)}%` }} />
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-7 grid grid-cols-2 border-l border-t border-[#d8d0c6]">
                    {[
                      ['Video hoàn thành', `${internalTraining.videosCompleted ?? 0}/${internalTraining.totalVideosAssigned ?? 0}`],
                      ['Điểm video TB', internalTraining.averageVideoScore ?? '—'],
                      ['Bài đạt', `${internalTraining.assignmentsPassed ?? 0}/${internalTraining.assignmentsTaken ?? 0}`],
                      ['Điểm bài TB', internalTraining.averageAssignmentScore ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="border-b border-r border-[#d8d0c6] p-4">
                        <p className="text-2xl font-black tracking-[-0.03em] tabular-nums">{value}</p>
                        <p className="mt-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#82786e]">{label}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {advancedTraining.available ? (
                <article className="border-t border-[#d8d0c6] py-7 lg:border-t-0 lg:px-7 lg:last:pr-0">
                  <div className="flex items-start justify-between gap-4">
                    <Sparkles className="h-6 w-6 text-[#bd0026]" />
                    {demoAdvancedTraining ? <DemoBadge /> : null}
                  </div>
                  <h3 className="mt-7 text-xl font-black tracking-[-0.025em]">Kiểm tra chuyên sâu</h3>
                  <div className="mt-7">
                    <div className="grid grid-cols-[1fr_auto] items-end gap-5 border-t border-[#d8d0c6] py-5">
                      <div>
                        <p className="text-sm font-bold">Điểm chuyên sâu TB</p>
                        <p className="mt-1 text-xs text-[#82786e]">{advancedTraining.expertiseRecords} lượt đánh giá</p>
                      </div>
                      <p className="text-4xl font-black tracking-[-0.04em] tabular-nums">{advancedTraining.expertiseAverage ?? '—'}</p>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-end gap-5 border-y border-[#d8d0c6] py-5">
                      <div>
                        <p className="text-sm font-bold">Điểm trải nghiệm TB</p>
                        <p className="mt-1 text-xs text-[#82786e]">{advancedTraining.experienceRecords} lượt đánh giá</p>
                      </div>
                      <p className="text-4xl font-black tracking-[-0.04em] tabular-nums">{advancedTraining.experienceAverage ?? '—'}</p>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}

          {trainingMedia.length > 0 ? (
            <div className="mt-16">
              <div className="flex items-center justify-between gap-4 border-b border-[#bfb5a9] pb-4">
                <div className="flex items-center gap-3">
                  <Camera className="h-5 w-5 text-[#bd0026]" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em]">Khoảnh khắc đào tạo</h3>
                </div>
                {demoMedia ? <DemoBadge /> : null}
              </div>
              <div className="grid md:grid-cols-3 md:divide-x md:divide-[#d8d0c6]">
                {trainingMedia.map((media, index) => (
                  <article key={media.id} className="group border-b border-[#d8d0c6] py-6 md:px-6 md:first:pl-0 md:last:pr-0">
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#e6ded3]">
                      <span className="absolute left-4 top-3 text-5xl font-black tracking-[-0.06em] text-[#c8bdb1]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <Camera className="absolute bottom-4 right-4 h-7 w-7 text-[#bd0026] transition-transform duration-300 group-hover:-translate-y-1" />
                    </div>
                    <p className="mt-5 text-sm font-black">{media.caption || 'Hoạt động đào tạo'}</p>
                    <p className="mt-2 text-xs font-semibold text-[#82786e]">{media.sessionTitle || 'Teacher Training'}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasJourney ? (
        <section id="journey" className="scroll-mt-24 border-t border-[#bfb5a9] bg-[#fbfaf7] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionTitle
              number="04"
              eyebrow="Vận hành"
              title="Hành trình giảng dạy tại MindX."
              description="Các con số phản ánh quy mô lớp học, số buổi và tổng thời lượng đứng lớp đã được ghi nhận trên TPS."
            />

            {hasOperations ? (
              <div className="grid grid-cols-2 border-y border-[#bfb5a9] lg:grid-cols-4">
                {[
                  { icon: Presentation, label: 'Số lớp', value: displayOperations.classCount },
                  { icon: Users, label: 'Học viên', value: displayOperations.studentCount },
                  { icon: CalendarDays, label: 'Buổi dạy', value: displayOperations.classSessions },
                  { icon: Clock3, label: 'Giờ giảng dạy', value: displayOperations.teachingHours !== null ? `${displayOperations.teachingHours}h` : null },
                ].map((metric, index) => (
                  <article
                    key={metric.label}
                    className={`px-4 py-7 sm:px-6 ${index % 2 === 1 ? 'border-l border-[#d8d0c6]' : ''} ${index > 1 ? 'border-t border-[#d8d0c6] lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-[#d8d0c6]' : ''} lg:px-7`}
                  >
                    <metric.icon className="h-5 w-5 text-[#bd0026]" />
                    <p className="mt-8 text-4xl font-black tracking-[-0.045em] tabular-nums">{metric.value ?? '—'}</p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#82786e]">{metric.label}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {data.honors.length > 0 || hasStudentAchievements ? (
              <div className={`mt-16 grid gap-14 ${data.honors.length > 0 && hasStudentAchievements ? 'lg:grid-cols-2 lg:gap-16' : ''}`}>
                {data.honors.length > 0 ? (
                  <div>
                    <SubsectionHeading icon={Award}>Vinh danh theo tháng</SubsectionHeading>
                    <div>
                      {data.honors.map((honor) => (
                        <article key={honor.id} className="grid gap-3 border-b border-[#d8d0c6] py-6 sm:grid-cols-[110px_1fr] sm:gap-6">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#bd0026]">{honor.month || 'Thành tích'}</p>
                          <div>
                            <h4 className="font-black">{honor.title}</h4>
                            {honor.detail ? <p className="mt-3 text-sm leading-7 text-[#70675f]">{honor.detail}</p> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {hasStudentAchievements ? (
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <SubsectionHeading icon={Trophy}>Học viên đạt giải</SubsectionHeading>
                      {demoStudentAwards.length > 0 ? <DemoBadge /> : null}
                    </div>
                    {demoStudentAwards.length > 0 ? (
                      <div>
                        {demoStudentAwards.map((award) => (
                          <article key={award.title} className="border-b border-[#d8d0c6] py-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#bd0026]">{award.competition}</p>
                            <h4 className="mt-2 text-lg font-black tracking-[-0.02em]">{award.title}</h4>
                            <p className="mt-3 text-sm text-[#70675f]">{award.result}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="border-b border-[#d8d0c6] py-7">
                        <p className="text-5xl font-black tracking-[-0.05em] text-[#bd0026] tabular-nums">
                          {data.studentAchievements.total ?? '—'}
                        </p>
                        <p className="mt-3 max-w-md text-sm leading-7 text-[#70675f]">
                          Thành tích học viên được ghi nhận từ quy trình cuộc thi và đề xuất thưởng trên TPS.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-[#bfb5a9] bg-[#f7f4ee] px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div className="flex items-center gap-4">
            <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-10 w-auto object-contain" />
            <span className="h-9 w-px bg-[#cfc6ba]" aria-hidden="true" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.13em]">Hồ sơ giáo viên</p>
              <p className="mt-1 text-[10px] font-semibold text-[#776f67]">Teaching Portal System</p>
            </div>
          </div>
          <p className="max-w-xl text-xs leading-6 text-[#776f67]">
            Trang portfolio công khai qua link chia sẻ. Ngày sinh, email, số điện thoại và các thông tin cá nhân khác không được hiển thị trên trang này.
          </p>
        </div>
      </footer>
    </main>
  )
}
