import {
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  Clock3,
  GraduationCap,
  Medal,
  Presentation,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import Image from 'next/image'

import { PortfolioMobileMenu } from '@/components/student-portfolio/portfolio-mobile-menu'
import { PortfolioPdfDownloadButton } from '@/components/student-portfolio/portfolio-pdf-download-button'
import { TeacherPortfolioProgressRail } from '@/components/teacher-portfolio/teacher-portfolio-progress-rail'
import type { TeacherPortfolioDto } from '@/lib/teacher-portfolio/types'
import logoTechAi from '@/logo_tech_ai_trong_suot.png'
import {
  formatTeacherPortfolioDate,
  teacherPortfolioInitials,
  type TeacherPortfolioPresentation,
} from './teacher-portfolio-presentation'

type CreativeViewProps = {
  data: TeacherPortfolioDto
  demoMode: boolean
  presentation: TeacherPortfolioPresentation
}

function SectionHeading({ number, eyebrow, title, inverse = false }: { number: string; eyebrow: string; title: string; inverse?: boolean }) {
  return (
    <div className="mb-12 sm:mb-16">
      <div className="mb-3 flex items-center gap-3">
        <span className={`text-2xl font-black tracking-[-0.06em] ${inverse ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{number}</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.19em] ${inverse ? 'text-slate-400' : 'text-slate-500'}`}>{eyebrow}</span>
      </div>
      <h2 className={`max-w-4xl text-3xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl ${inverse ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h2>
    </div>
  )
}

function DemoBadge() {
  return <span className="inline-flex rounded bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">Minh họa</span>
}

export function TeacherPortfolioCreativeView({ data, demoMode: _demoMode, presentation }: CreativeViewProps) {
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
    { icon: Presentation, value: displayOperations.classCount, label: 'Lớp học' },
    { icon: Users, value: displayOperations.studentCount, label: 'Học viên' },
    { icon: CalendarDays, value: displayOperations.classSessions, label: 'Buổi dạy' },
    { icon: Clock3, value: displayOperations.teachingHours !== null ? `${displayOperations.teachingHours}h` : null, label: 'Đứng lớp' },
  ]
  const hasRecognition = data.honors.length > 0 || demoStudentAwards.length > 0 || data.studentAchievements.available
  const visibleSections = sections.filter((section) => section.id !== 'journey' || hasRecognition)
  const nextSection = visibleSections[1]?.id ?? 'profile'

  return (
    <main className="portfolio-theme min-h-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A]">
      <TeacherPortfolioProgressRail sections={visibleSections} themeColor="#DC2626" />

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="#profile" className="flex min-w-0 items-center gap-4">
            <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-9 w-auto shrink-0 object-contain sm:h-11" priority />
            <p className="hidden border-l border-slate-300 pl-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 sm:block">Hồ sơ giáo viên</p>
          </a>
          <nav className="hidden items-center gap-6 xl:flex" aria-label="Điều hướng portfolio">
            {visibleSections.slice(1).map((section) => <a key={section.id} href={`#${section.id}`} className="text-[11px] font-bold text-slate-600 transition-colors hover:text-[#DC2626]">{section.label}</a>)}
          </nav>
          <div className="flex items-center gap-2"><PortfolioPdfDownloadButton /><PortfolioMobileMenu sections={visibleSections} themeColor="#DC2626" /></div>
        </div>
      </header>

      <section id="profile" className="relative scroll-mt-20 overflow-hidden border-b border-slate-100 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-amber-100/70" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-28 bottom-0 h-64 w-64 rounded-full bg-red-50" aria-hidden="true" />
        <div className="relative mx-auto grid min-h-[660px] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-7">
            <div className="animate-fade-in-up inline-flex items-center gap-3">
              <span className="grid h-10 w-10 -rotate-3 place-items-center rounded-xl bg-[#0F172A] text-[#F59E0B] shadow-[0_8px_24px_rgba(15,23,42,0.16)]"><Sparkles className="h-4 w-4" /></span>
              <span><span className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#DC2626]">MindX educator</span><span className="mt-0.5 block text-sm font-bold text-slate-700">Người truyền cảm hứng</span></span>
            </div>
            <h1 className="animate-fade-in-up animation-delay-200 mt-7 max-w-4xl text-[clamp(3.5rem,7.2vw,6.7rem)] font-black leading-[0.92] tracking-[-0.065em] text-[#0F172A]">{data.profile.displayName}</h1>
            <div className="animate-fade-in-up animation-delay-300 mt-7 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-[#F59E0B]" />{data.profile.professionalTitle}</span>
              {data.profile.centerName ? <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-bold text-slate-600"><Building2 className="h-4 w-4 text-[#DC2626]" />{data.profile.centerName}</span> : null}
            </div>
            {data.profile.courseLines.length > 0 ? <div className="animate-fade-in-up animation-delay-300 mt-7 flex max-w-2xl flex-wrap gap-2">{data.profile.courseLines.map((course) => <span key={course} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-transform duration-300 hover:-translate-y-0.5 hover:border-slate-300">{course}</span>)}</div> : null}
            <a href={`#${nextSection}`} className="animate-fade-in-up animation-delay-400 mt-10 inline-flex items-center gap-3 rounded-xl border-2 border-[#0F172A] px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all duration-300 hover:-translate-y-1 hover:bg-[#0F172A] hover:text-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.18)]">Khám phá hành trình <ArrowUpRight className="h-4 w-4" /></a>
          </div>

          <div className="animate-slide-in-right animation-delay-200 relative mx-auto w-full max-w-[410px] lg:col-span-5 lg:justify-self-end">
            <div className="absolute -right-4 -top-4 h-48 w-48 rounded-3xl bg-[#F59E0B]" aria-hidden="true" />
            <div className="absolute -bottom-5 -left-5 h-36 w-36 -rotate-6 rounded-3xl bg-[#DC2626]" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-3xl border-4 border-white bg-slate-100 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
              <div className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-[#0F172A] backdrop-blur">Mentor MindX</div>
              <div className="relative aspect-[4/5] overflow-hidden">
                {data.profile.avatarUrl ? <Image src={data.profile.avatarUrl} alt={`Ảnh đại diện ${data.profile.displayName}`} fill sizes="(max-width: 1024px) 90vw, 410px" className="object-cover object-top transition-transform duration-500 hover:scale-[1.03]" unoptimized /> : <div className="grid h-full place-items-center bg-[#0F172A] text-7xl font-black text-[#F59E0B]">{teacherPortfolioInitials(data.profile.displayName)}</div>}
              </div>
              <div className="flex items-center justify-center gap-2 bg-[#0F172A] px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.19em] text-white"><span className="h-2 w-2 rounded-full bg-emerald-400" />Teacher / Mentor</div>
            </div>
          </div>
        </div>
      </section>

      {hasOperations ? <section className="relative z-10 bg-[#DC2626] text-white shadow-[0_12px_30px_rgba(185,28,28,0.18)]"><div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">{metrics.map((metric, index) => <div key={metric.label} className={`relative flex flex-col items-center justify-center px-4 py-9 text-center ${index % 2 ? 'border-l border-red-400/50' : ''} ${index > 1 ? 'border-t border-red-400/50 lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l' : ''}`}><p className="text-4xl font-black tracking-[-0.05em] sm:text-5xl">{metric.value ?? '—'}</p><p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-100">{metric.label}</p>{demoOperations ? <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#F59E0B]" aria-label="Dữ liệu minh họa" /> : null}</div>)}</div></section> : null}

      {hasBackground ? <section id="background" className="scroll-mt-24 border-b border-slate-200 bg-white py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><SectionHeading number="01" eyebrow="Nền tảng" title="Mỗi chặng đường đều để lại một phương pháp giảng dạy." /><div className="grid gap-12 lg:grid-cols-2">{data.education.length > 0 ? <div><div className="mb-6 flex items-center gap-2 border-b-2 border-[#DC2626] pb-3"><GraduationCap className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Học vấn</h3></div><div className="space-y-4">{data.education.map((item, index) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-7"><div className="flex items-start gap-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-100 text-lg font-black text-[#DC2626]">{String(index + 1).padStart(2, '0')}</span><div><h4 className="text-xl font-black">{item.institution}</h4><p className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">{item.qualification}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}</p><p className="mt-3 text-xs font-bold text-slate-500">{item.startYear || '—'} — {item.endYear || 'Nay'}</p>{item.description ? <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p> : null}</div></div></article>)}</div></div> : null}{data.experiences.length > 0 ? <div><div className="mb-6 flex items-center gap-2 border-b-2 border-[#0F172A] pb-3"><BriefcaseBusiness className="h-5 w-5 text-[#0F172A]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Kinh nghiệm</h3></div><div className="space-y-4">{data.experiences.map((item, index) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-7"><div className="flex items-start gap-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#0F172A] text-lg font-black text-[#F59E0B]">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-3"><h4 className="text-xl font-black">{item.jobTitle}</h4><p className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">{formatTeacherPortfolioDate(item.startDate)} — {item.isCurrent ? 'Hiện tại' : formatTeacherPortfolioDate(item.endDate)}</p></div><p className="mt-2 text-sm font-black text-[#DC2626]">{item.organization}</p>{item.description ? <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p> : null}</div></div></article>)}</div></div> : null}</div></div></section> : null}

      {hasCredentials ? <section id="credentials" className="scroll-mt-24 border-b border-slate-200 bg-[#F8FAFC] py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><SectionHeading number="02" eyebrow="Dấu ấn" title="Năng lực được ghi lại bằng những cột mốc cụ thể." /><div className="grid gap-8 lg:grid-cols-2">{certificates.length > 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><div className="flex items-center gap-2"><Award className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Chứng chỉ</h3></div>{demoCertificates ? <DemoBadge /> : null}</div><div className="mt-5 space-y-3">{certificates.map((item) => <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#DC2626]">{item.type}</p><h4 className="mt-1 text-lg font-black">{item.name}</h4>{item.issueDate ? <p className="mt-2 text-xs font-bold text-slate-500">{formatTeacherPortfolioDate(item.issueDate)}</p> : null}{item.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p> : null}</article>)}</div></div> : null}{data.achievements.length > 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-2 border-b border-slate-100 pb-4"><Medal className="h-5 w-5 text-[#F59E0B]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Giải thưởng & cuộc thi</h3></div><div className="mt-5 space-y-4">{data.achievements.map((item) => <article key={item.id} className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-5"><span className="inline-flex rounded-full bg-[#F59E0B] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#0F172A]">{item.category === 'competition' ? 'Cuộc thi' : 'Giải thưởng'}</span><h4 className="mt-3 text-xl font-black">{item.title}</h4><p className="mt-2 text-sm font-semibold text-slate-600">{[item.organization, item.level].filter(Boolean).join(' · ') || 'Thành tích chuyên môn'}</p>{item.description ? <p className="mt-3 border-l-4 border-[#DC2626] pl-4 text-sm italic leading-6 text-slate-500">{item.description}</p> : null}</article>)}</div></div> : null}</div></div></section> : null}

      {hasTraining ? <section id="training" className="relative scroll-mt-24 overflow-hidden bg-[#0F172A] py-20 text-white sm:py-28"><div className="pointer-events-none absolute right-[15%] top-0 h-72 w-72 rounded-full bg-red-900/20" aria-hidden="true" /><div className="relative mx-auto max-w-7xl px-5 sm:px-8"><SectionHeading number="03" eyebrow="Training Lab" title="Học để dạy tốt hơn. Thử nghiệm để tiến xa hơn." inverse /><div className="grid gap-7 md:grid-cols-3"><article className="rounded-2xl border border-slate-700 bg-[#1E293B] p-6"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F59E0B]">Phase 01</p>{demoOnboarding ? <span className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold uppercase text-slate-300">Minh họa</span> : null}</div><h3 className="mt-3 text-xl font-black">Đào tạo đầu vào</h3><p className="mt-2 text-xs font-semibold text-slate-400">{data.training.onboarding.genName || 'Teacher Onboarding'}</p><div className="mt-6 space-y-4">{onboardingSessions.map((session) => { const progress = session.score === null ? 0 : Math.max(0, Math.min(100, session.score * 10)); return <div key={session.id}><div className="mb-2 flex items-start justify-between gap-3 text-xs font-bold"><span className="text-slate-300">{String(session.sessionNumber).padStart(2, '0')} · {session.title}</span><span className="text-[#F59E0B]">{session.score ?? '—'}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${progress}%` }} /></div></div>})}</div></article><article className="rounded-2xl border border-slate-700 bg-[#1E293B] p-6"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F59E0B]">Phase 02</p>{demoInternalTraining ? <span className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold uppercase text-slate-300">Nội bộ</span> : null}</div><h3 className="mt-3 text-xl font-black">Training nội bộ</h3>{internalTraining.available ? <div className="mt-6 grid grid-cols-2 gap-3">{[['Tiến độ video', trainingCompletion !== null ? `${trainingCompletion}%` : '—'], ['Điểm video', internalTraining.averageVideoScore ?? '—'], ['Bài đạt', `${internalTraining.assignmentsPassed ?? 0}/${internalTraining.assignmentsTaken ?? 0}`], ['Điểm bài', internalTraining.averageAssignmentScore ?? '—']].map(([label, value], index) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 text-center"><p className={`text-3xl font-black ${index % 3 === 0 ? 'text-[#F59E0B]' : 'text-white'}`}>{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p></div>)}</div> : <p className="mt-6 text-sm text-slate-400">Chưa có dữ liệu.</p>}</article><article className="rounded-2xl border border-slate-700 bg-[#1E293B] p-6"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F59E0B]">Phase 03</p>{demoAdvancedTraining ? <span className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold uppercase text-slate-300">Nâng cao</span> : null}</div><h3 className="mt-3 text-xl font-black">Chuyên sâu</h3>{advancedTraining.available ? <div className="mt-7 space-y-5"><div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/80 p-4"><span className="text-sm font-bold text-slate-300">Chuyên môn</span><span className="text-3xl font-black text-[#F59E0B]">{advancedTraining.expertiseAverage ?? '—'}</span></div><div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/80 p-4"><span className="text-sm font-bold text-slate-300">Trải nghiệm</span><span className="text-3xl font-black text-emerald-400">{advancedTraining.experienceAverage ?? '—'}</span></div></div> : <p className="mt-6 text-sm text-slate-400">Chưa có dữ liệu.</p>}</article></div>{trainingMedia.length > 0 ? <div className="mt-16 border-t border-slate-800 pt-8"><div className="mb-8 flex items-center justify-between gap-4"><h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Khoảnh khắc đào tạo</h3>{demoMedia ? <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">Dữ liệu minh họa</span> : null}</div><div className="grid gap-6 md:grid-cols-3">{trainingMedia.map((media, index) => <article key={media.id} className="group overflow-hidden rounded-2xl border border-slate-700 bg-[#1E293B]"><div className={`${index === 1 ? 'bg-[#DC2626]' : index === 2 ? 'bg-[#F59E0B]' : 'bg-slate-800'} relative grid aspect-video place-items-center overflow-hidden`}><span className="absolute left-4 top-2 text-5xl font-black text-white/25">{index + 1}</span><Camera className={`h-9 w-9 ${index === 2 ? 'text-[#0F172A]' : 'text-white'}`} /></div><div className="p-5"><h4 className="font-black">{media.caption || 'Hoạt động đào tạo'}</h4><p className="mt-1 text-xs text-slate-400">{media.sessionTitle || 'Teacher Training'}</p></div></article>)}</div></div> : null}</div></section> : null}

      {hasRecognition ? (
        <section id="journey" className="scroll-mt-24 border-b border-slate-200 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <SectionHeading number="04" eyebrow="Tác động" title="Những dấu ấn được tạo nên trong hành trình giảng dạy." />
            <div className="grid gap-10 lg:grid-cols-2">
              {data.honors.length > 0 ? <div><div className="mb-7 flex items-center gap-2 border-b-2 border-[#DC2626] pb-4"><Trophy className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Vinh danh</h3></div><div className="space-y-4">{data.honors.map((honor) => <article key={honor.id} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 pl-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)]"><span className="absolute inset-y-0 left-0 w-2 bg-[#DC2626]" /><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#DC2626]">{honor.month}</p><h4 className="mt-2 text-xl font-black">{honor.title}</h4>{honor.detail ? <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{honor.detail}</p> : null}</article>)}</div></div> : null}
              <div className={data.honors.length > 0 ? '' : 'lg:col-span-2'}><div className="mb-7 flex items-center gap-2 border-b-2 border-[#0F172A] pb-4"><Award className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Học viên đạt giải</h3></div><div className="grid gap-4 md:grid-cols-2">{demoStudentAwards.map((award, index) => <article key={award.title} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 pl-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)]"><span className={`absolute inset-y-0 left-0 w-2 ${index % 2 ? 'bg-[#F59E0B]' : 'bg-[#DC2626]'}`} /><p className={`text-[10px] font-black uppercase tracking-[0.14em] ${index % 2 ? 'text-amber-600' : 'text-[#DC2626]'}`}>{award.competition}</p><h4 className="mt-2 text-xl font-black">{award.title}</h4><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{award.result}</p></article>)}{demoStudentAwards.length === 0 && data.studentAchievements.available ? <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 pl-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)]"><span className="absolute inset-y-0 left-0 w-2 bg-[#DC2626]" /><p className="text-5xl font-black text-[#DC2626]">{data.studentAchievements.total ?? '—'}</p><p className="mt-2 text-sm font-semibold text-slate-600">Thành tích học viên được ghi nhận.</p></article> : null}</div></div>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-slate-200 bg-white px-5 py-12 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 md:flex-row md:items-center"><Image src={logoTechAi} alt="MindX Tech & AI School" className="h-11 w-auto object-contain" /><p className="max-w-xl text-xs font-semibold leading-6 text-slate-500">Teacher Portfolio · Hồ sơ công khai về hành trình chuyên môn, đào tạo và tác động trong lớp học.</p></div></footer>
    </main>
  )
}
