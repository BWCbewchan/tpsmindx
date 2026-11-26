import {
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  Building2,
  Camera,
  GraduationCap,
  Medal,
  Sparkles,
  Trophy,
} from 'lucide-react'
import Image from 'next/image'

import { PortfolioMobileMenu } from '@/components/student-portfolio/portfolio-mobile-menu'
import { PortfolioPdfDownloadButton } from '@/components/student-portfolio/portfolio-pdf-download-button'
import type { TeacherPortfolioDto } from '@/lib/teacher-portfolio/types'
import logoTechAi from '@/logo_tech_ai_trong_suot.webp'
import {
  formatTeacherPortfolioDate,
  teacherPortfolioInitials,
  type TeacherPortfolioPresentation,
} from './teacher-portfolio-presentation'

type EditorialViewProps = {
  data: TeacherPortfolioDto
  demoMode: boolean
  presentation: TeacherPortfolioPresentation
}

function SectionHeading({
  number,
  eyebrow,
  title,
  inverse = false,
}: {
  number: string
  eyebrow: string
  title: string
  inverse?: boolean
}) {
  return (
    <div className="mb-12 max-w-3xl">
      <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em]">
        <span className={inverse ? 'text-[#f8cf65]' : 'text-[#9e0b22]'}>{number}</span>
        <span className={inverse ? 'text-rose-200' : 'text-slate-400'}>{eyebrow}</span>
      </div>
      <h2 className={`mt-2 text-2xl font-extrabold leading-[1.22] tracking-[-0.035em] sm:text-3xl lg:text-4xl ${inverse ? 'text-white' : 'text-slate-950'}`}>
        {title}
      </h2>
    </div>
  )
}

function DemoBadge() {
  return <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-700">Minh họa</span>
}

function ColumnHeading({
  icon: Icon,
  children,
  accent = 'red',
}: {
  icon: typeof GraduationCap
  children: React.ReactNode
  accent?: 'red' | 'amber'
}) {
  return (
    <div className="mb-6 flex items-center gap-2 border-b-2 border-[#9e0b22] pb-3">
      <Icon className={`h-4 w-4 ${accent === 'amber' ? 'text-amber-500' : 'text-[#9e0b22]'}`} />
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800">{children}</h3>
    </div>
  )
}

export function TeacherPortfolioEditorialView({
  data,
  demoMode: _demoMode,
  presentation,
}: EditorialViewProps) {
  const {
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
    trainingCompletion,
    sections,
  } = presentation

  const metrics = [
    { value: displayOperations.classCount, label: 'Lớp học' },
    { value: displayOperations.studentCount, label: 'Học viên' },
    { value: displayOperations.classSessions, label: 'Buổi dạy' },
    { value: displayOperations.teachingHours !== null ? `${displayOperations.teachingHours}h` : null, label: 'Đứng lớp' },
  ]
  const hasRecognition = data.honors.length > 0 || demoStudentAwards.length > 0 || data.studentAchievements.available
  const visibleSections = sections.filter((section) => section.id !== 'journey' || hasRecognition)
  const nextSection = visibleSections[1]?.id ?? 'profile'
  const trainingColumns = [onboardingSessions.length > 0, internalTraining.available, advancedTraining.available].filter(Boolean).length
  const trainingGridClass = trainingColumns >= 3 ? 'lg:grid-cols-3' : trainingColumns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'

  return (
    <main className="portfolio-theme min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="portfolio-print-hidden sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#profile" className="flex min-w-0 items-center gap-3">
            <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-9 w-auto shrink-0 object-contain" priority />
            <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:block">Hồ sơ giáo viên</span>
          </a>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Điều hướng portfolio">
            {visibleSections.slice(1).map((section) => (
              <a key={section.id} href={`#${section.id}`} className="text-[11px] font-medium text-slate-600 transition-colors hover:text-[#9e0b22]">
                {section.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <PortfolioPdfDownloadButton />
            <PortfolioMobileMenu sections={visibleSections} themeColor="#9e0b22" />
          </div>
        </div>
      </header>

      <section id="profile" className="portfolio-print-section-hero relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-white to-slate-50/60 py-14 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-32 bg-amber-50/70" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="space-y-6 lg:col-span-7">
              <div className="animate-fade-in-up inline-flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#9e0b22] text-white shadow-sm"><Sparkles className="h-4 w-4" /></span>
                <span className="leading-tight">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e0b22]">MindX educator</span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-800">Người truyền cảm hứng</span>
                </span>
              </div>

              <h1 className="animate-fade-in-up animation-delay-200 text-4xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                {data.profile.displayName}
              </h1>

              <div className="animate-fade-in-up animation-delay-300 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />{data.profile.professionalTitle}
                </span>
                {data.profile.centerName ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700">
                    <Building2 className="h-3.5 w-3.5 text-[#9e0b22]" />{data.profile.centerName}
                  </span>
                ) : null}
              </div>

              <div className="animate-fade-in-up animation-delay-400 pt-2">
                <a href={`#${nextSection}`} className="inline-flex items-center gap-2.5 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-800 shadow-sm transition-all hover:border-[#9e0b22] hover:text-[#9e0b22]">
                  Khám phá hành trình <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="flex justify-center lg:col-span-5 lg:justify-end">
              <div className="animate-slide-in-right animation-delay-200 relative w-full max-w-[340px]">
                <div className="absolute -right-4 -top-4 h-24 w-24 bg-amber-300/80" aria-hidden="true" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 bg-[#9e0b22]/85" aria-hidden="true" />
                <div className="relative overflow-hidden rounded-2xl border-4 border-white bg-sky-100 shadow-xl">
                  <span className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold text-slate-800 shadow-sm backdrop-blur-sm">Mentor MindX</span>
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {data.profile.avatarUrl ? (
                      <Image src={data.profile.avatarUrl} alt={`Chân dung giáo viên ${data.profile.displayName}`} fill priority sizes="(max-width: 1024px) 90vw, 340px" className="object-cover object-top" unoptimized />
                    ) : (
                      <div className="grid h-full place-items-center bg-[#9e0b22] text-7xl font-extrabold text-amber-300">{teacherPortfolioInitials(data.profile.displayName)}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-[#9e0b22] px-4 py-2.5 text-white">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Teacher / Mentor</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {hasOperations ? (
        <section className="bg-[#9e0b22] text-white" aria-label="Thống kê giảng dạy">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <div className="grid grid-cols-2 divide-y divide-white/15 md:grid-cols-4 md:divide-x md:divide-y-0">
              {metrics.map((metric) => (
                <div key={metric.label} className="relative px-4 py-4 text-center md:py-0">
                  <p className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{metric.value ?? '—'}</p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-rose-200">{metric.label}</p>
                  {demoOperations ? <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-amber-300" aria-label="Dữ liệu minh họa" /> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasBackground ? (
        <section id="background" className="portfolio-print-section-intro scroll-mt-24 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading number="01" eyebrow="Nền tảng" title="Mỗi chặng đường đều để lại một phương pháp giảng dạy." />
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
              {data.education.length > 0 ? (
                <div>
                  <ColumnHeading icon={GraduationCap}>Học vấn</ColumnHeading>
                  <div className="space-y-4">
                    {data.education.map((item, index) => (
                      <article key={item.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-xs font-bold text-[#9e0b22]">{String(index + 1).padStart(2, '0')}</span>
                          <div className="min-w-0 space-y-2">
                            <h4 className="text-base font-bold text-slate-950">{item.institution}</h4>
                            <span className="inline-block rounded bg-slate-200/70 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">{item.qualification}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}</span>
                            {item.startYear || item.endYear ? <p className="text-[11px] font-medium text-slate-500">{item.startYear || '—'} — {item.endYear || 'Nay'}</p> : null}
                            {item.description ? <p className="pt-1 text-xs leading-relaxed text-slate-600">{item.description}</p> : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.experiences.length > 0 ? (
                <div>
                  <ColumnHeading icon={BriefcaseBusiness}>Kinh nghiệm</ColumnHeading>
                  <div className="space-y-4">
                    {data.experiences.map((item, index) => (
                      <article key={item.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#9e0b22] text-xs font-bold text-white">{String(index + 1).padStart(2, '0')}</span>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h4 className="text-base font-bold text-slate-950">{item.jobTitle}</h4>
                              <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[9px] font-semibold text-slate-600">{formatTeacherPortfolioDate(item.startDate)} — {item.isCurrent ? 'Hiện tại' : formatTeacherPortfolioDate(item.endDate)}</span>
                            </div>
                            <p className="text-[11px] font-bold text-[#9e0b22]">{item.organization}</p>
                            {item.description ? <p className="pt-1 text-xs leading-relaxed text-slate-600">{item.description}</p> : null}
                          </div>
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

      {hasCredentials ? (
        <section id="credentials" className="scroll-mt-24 border-t border-slate-100 bg-slate-50/50 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading number="02" eyebrow="Dấu ấn" title="Năng lực được ghi lại bằng những cột mốc cụ thể." />
            <div className={`grid gap-8 ${certificates.length > 0 && data.achievements.length > 0 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
              {certificates.length > 0 ? (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-2"><Award className="h-4 w-4 text-[#9e0b22]" /><h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800">Chứng chỉ</h3></div>
                    {demoCertificates ? <DemoBadge /> : null}
                  </div>
                  <div className="space-y-4">
                    {certificates.map((item) => (
                      <article key={item.id} className="rounded-xl border border-slate-200/70 bg-slate-50 p-5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9e0b22]">{item.type}</p>
                        <h4 className="mt-1 text-sm font-bold text-slate-950">{item.name}</h4>
                        {item.issueDate ? <p className="mt-1 text-[10px] font-medium text-slate-500">{formatTeacherPortfolioDate(item.issueDate)}</p> : null}
                        {item.description ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.description}</p> : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.achievements.length > 0 ? (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-5"><Medal className="h-4 w-4 text-amber-500" /><h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800">Giải thưởng & cuộc thi</h3></div>
                  <div className="space-y-4">
                    {data.achievements.map((item) => (
                      <article key={item.id} className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-6">
                        <span className="inline-flex rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[9px] font-bold uppercase text-amber-900">{item.category === 'competition' ? 'Cuộc thi' : 'Giải thưởng'}</span>
                        <h4 className="mt-3 text-base font-bold text-slate-950">{item.title}</h4>
                        <p className="mt-1 text-xs font-medium text-slate-600">{[item.organization, item.level].filter(Boolean).join(' · ') || 'Thành tích chuyên môn'}</p>
                        {item.description ? <blockquote className="mt-4 border-l-2 border-[#9e0b22] pl-3 text-xs italic leading-relaxed text-slate-600">{item.description}</blockquote> : null}
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
        <section id="training" className="relative scroll-mt-24 overflow-hidden bg-[#9e0b22] py-16 text-white sm:py-24">
          <div className="pointer-events-none absolute right-12 top-12 h-72 w-72 rounded-full bg-white/[0.04]" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading number="03" eyebrow="Training Lab" title="Học để dạy tốt hơn. Thử nghiệm để tiến xa hơn." inverse />

            {trainingColumns > 0 ? (
              <div className={`grid gap-6 ${trainingGridClass}`}>
                {onboardingSessions.length > 0 ? (
                  <article className="flex flex-col justify-between rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-xl sm:p-7">
                    <div>
                      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9e0b22]">Phase 01</span>{demoOnboarding ? <DemoBadge /> : null}</div>
                      <h3 className="mt-2 text-lg font-extrabold text-slate-950">Đào tạo đầu vào</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{data.training.onboarding.genName || 'Teacher Onboarding'}</p>
                      <div className="mt-6 space-y-5">
                        {onboardingSessions.map((session, index) => {
                          const progress = session.score === null ? 0 : Math.max(0, Math.min(100, session.score * 10))
                          return (
                            <div key={session.id}>
                              <div className="mb-1.5 flex items-start justify-between gap-3 text-[11px] font-semibold">
                                <span className="text-slate-700">{String(session.sessionNumber || index + 1).padStart(2, '0')} - {session.title}</span>
                                <span className="shrink-0 font-bold text-[#9e0b22]">{session.score ?? '—'}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`${index === onboardingSessions.length - 1 ? 'bg-[#9e0b22]' : 'bg-amber-500'} h-full rounded-full`} style={{ width: `${progress}%` }} /></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </article>
                ) : null}

                {internalTraining.available ? (
                  <article className="flex flex-col rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-xl sm:p-7">
                    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9e0b22]">Phase 02</span>{demoInternalTraining ? <DemoBadge /> : null}</div>
                    <h3 className="mt-2 text-lg font-extrabold text-slate-950">Training nội bộ</h3>
                    <div className="mt-6 grid flex-1 grid-cols-2 gap-3.5">
                      {[
                        { label: 'Tiến độ video', value: trainingCompletion !== null ? `${trainingCompletion}%` : '—', color: 'text-amber-600' },
                        { label: 'Điểm video', value: internalTraining.averageVideoScore ?? '—', color: 'text-[#9e0b22]' },
                        { label: 'Bài đạt', value: `${internalTraining.assignmentsPassed ?? 0}/${internalTraining.assignmentsTaken ?? 0}`, color: 'text-slate-950' },
                        { label: 'Điểm bài', value: internalTraining.averageAssignmentScore ?? '—', color: 'text-amber-600' },
                      ].map((metric) => (
                        <div key={metric.label} className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-center">
                          <span className={`text-2xl font-extrabold sm:text-3xl ${metric.color}`}>{metric.value}</span>
                          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{metric.label}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}

                {advancedTraining.available ? (
                  <article className="flex flex-col rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-xl sm:p-7">
                    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9e0b22]">Phase 03</span>{demoAdvancedTraining ? <DemoBadge /> : null}</div>
                    <h3 className="mt-2 text-lg font-extrabold text-slate-950">Chuyên sâu</h3>
                    <div className="mt-6 flex flex-1 flex-col justify-center space-y-3.5">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-5 py-5"><span className="text-xs font-bold text-slate-700">Chuyên môn</span><span className="text-2xl font-extrabold text-amber-600 sm:text-3xl">{advancedTraining.expertiseAverage ?? '—'}</span></div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-5 py-5"><span className="text-xs font-bold text-slate-700">Trải nghiệm</span><span className="text-2xl font-extrabold text-emerald-600 sm:text-3xl">{advancedTraining.experienceAverage ?? '—'}</span></div>
                    </div>
                  </article>
                ) : null}
              </div>
            ) : null}

            {trainingMedia.length > 0 ? (
              <div className="mt-14 border-t border-white/15 pt-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-200">Training moments</p><h3 className="mt-1 text-xl font-extrabold text-white">Khoảnh khắc đào tạo</h3></div>
                  {demoMedia ? <span className="rounded border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white">Minh họa</span> : null}
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {trainingMedia.map((media, index) => (
                    <article key={media.id} className="group overflow-hidden rounded-2xl border border-white/20 bg-white p-3 text-slate-900 shadow-xl">
                      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border border-rose-100 bg-[#fff7f8]">
                        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(158,11,34,.12)_1px,transparent_1px)] [background-size:18px_18px]" aria-hidden="true" />
                        <span className="absolute left-4 top-3 text-5xl font-extrabold tracking-[-0.06em] text-[#9e0b22]/15">{String(index + 1).padStart(2, '0')}</span>
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#9e0b22] text-white shadow-lg transition-transform duration-300 group-hover:-translate-y-1"><Camera className="h-5 w-5" /></span>
                      </div>
                      <div className="px-2 pb-2 pt-4"><h4 className="text-sm font-bold text-slate-950">{media.caption || 'Hoạt động đào tạo'}</h4><p className="mt-1 text-[11px] font-medium text-slate-500">{media.sessionTitle || 'Teacher Training'}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasRecognition ? (
        <section id="journey" className="scroll-mt-24 border-b border-slate-100 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading number="04" eyebrow="Tác động" title="Những dấu ấn được tạo nên trong hành trình giảng dạy." />
            <div className={`grid gap-8 ${data.honors.length > 0 && (demoStudentAwards.length > 0 || data.studentAchievements.available) ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
              {data.honors.length > 0 ? (
                <div>
                  <ColumnHeading icon={Trophy}>Vinh danh</ColumnHeading>
                  <div className="space-y-4">
                    {data.honors.map((honor) => (
                      <article key={honor.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#9e0b22]">{honor.month || 'Thành tích'}</p>
                        <h4 className="mt-2 text-base font-bold text-slate-950">{honor.title}</h4>
                        {honor.detail ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{honor.detail}</p> : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {demoStudentAwards.length > 0 || data.studentAchievements.available ? (
                <div>
                  <ColumnHeading icon={Award} accent="amber">Học viên đạt giải</ColumnHeading>
                  <div className="space-y-4">
                    {demoStudentAwards.map((award) => (
                      <article key={award.title} className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-6 shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700">{award.competition}</p>
                        <h4 className="mt-2 text-base font-bold text-slate-950">{award.title}</h4>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">{award.result}</p>
                      </article>
                    ))}
                    {demoStudentAwards.length === 0 && data.studentAchievements.available ? (
                      <article className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm">
                        <p className="text-4xl font-extrabold text-[#9e0b22]">{data.studentAchievements.total ?? '—'}</p>
                        <p className="mt-2 text-xs text-slate-600">Thành tích học viên được ghi nhận trên TPS.</p>
                      </article>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-9 w-auto object-contain" />
          <p className="max-w-2xl text-center text-[10px] leading-5 text-slate-500 sm:text-right">Teacher Portfolio · Hồ sơ công khai về hành trình chuyên môn, đào tạo và tác động trong lớp học.</p>
        </div>
      </footer>
    </main>
  )
}
