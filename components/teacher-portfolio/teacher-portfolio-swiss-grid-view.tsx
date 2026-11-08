import {
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
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

type SwissGridViewProps = {
  data: TeacherPortfolioDto
  demoMode: boolean
  presentation: TeacherPortfolioPresentation
}

function GridHeading({ index, kicker, title }: { index: string; kicker: string; title: string }) {
  return (
    <div className="grid border-y-2 border-[#17324d] md:grid-cols-[150px_1fr]">
      <div className="flex items-center justify-between bg-[#bd0026] px-5 py-5 text-white md:block">
        <p className="text-4xl font-black tracking-[-0.07em]">{index}</p>
        <p className="mt-0 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 md:mt-8">{kicker}</p>
      </div>
      <div className="flex items-center bg-white px-5 py-7 md:px-8">
        <h2 className="max-w-4xl text-3xl font-black uppercase leading-[0.96] tracking-[-0.05em] text-[#17324d] sm:text-5xl">{title}</h2>
      </div>
    </div>
  )
}

function DemoMark({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex bg-[#f2c94c] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#17324d]">{children}</span>
}

export function TeacherPortfolioSwissGridView({ data, demoMode, presentation }: SwissGridViewProps) {
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
    hasJourney,
    hasDemoContent,
    trainingCompletion,
    sections,
  } = presentation

  const metrics = [
    { icon: Presentation, value: displayOperations.classCount, label: 'Lớp phụ trách' },
    { icon: Users, value: displayOperations.studentCount, label: 'Học viên' },
    { icon: CalendarDays, value: displayOperations.classSessions, label: 'Buổi giảng dạy' },
    { icon: Clock3, value: displayOperations.teachingHours !== null ? `${displayOperations.teachingHours}h` : null, label: 'Giờ đứng lớp' },
  ]
  const nextSection = sections[1]?.id ?? 'profile'

  return (
    <main className="portfolio-theme min-h-screen overflow-hidden bg-white text-[#17324d]">
      <TeacherPortfolioProgressRail sections={sections} themeColor="#bd0026" />

      <header className="sticky top-0 z-30 border-b-2 border-[#17324d] bg-white/95 px-4 py-3 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="#profile" className="flex min-w-0 items-center gap-4">
            <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-9 w-auto shrink-0 object-contain sm:h-11" priority />
            <div className="hidden border-l-4 border-[#bd0026] pl-4 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">Hồ sơ giáo viên</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#bd0026]">Mẫu 04 · Academic Grid</p>
            </div>
          </a>
          <nav className="hidden items-center gap-5 xl:flex" aria-label="Điều hướng portfolio">
            {sections.slice(1).map((section) => <a key={section.id} href={`#${section.id}`} className="border-b-2 border-transparent pb-1 text-[10px] font-black uppercase tracking-[0.12em] transition hover:border-[#f2c94c] hover:text-[#bd0026]">{section.label}</a>)}
          </nav>
          <div className="flex items-center gap-2"><PortfolioPdfDownloadButton /><PortfolioMobileMenu sections={sections} themeColor="#bd0026" /></div>
        </div>
      </header>

      {hasDemoContent ? <div className="border-b-2 border-[#17324d] bg-[#f2c94c] px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#17324d] print:hidden">{demoMode ? 'Bản trình bày · Dữ liệu còn thiếu được mô phỏng để duyệt Mẫu 4' : 'Một số nội dung đang sử dụng dữ liệu minh họa'}</div> : null}

      <section id="profile" className="scroll-mt-20 border-b-2 border-[#17324d]">
        <div className="mx-auto grid min-h-[680px] max-w-7xl border-x-2 border-[#17324d] lg:grid-cols-12">
          <div className="relative flex flex-col justify-between bg-[#bd0026] p-6 text-white sm:p-10 lg:col-span-7 lg:p-14">
            <div className="flex items-start justify-between gap-8">
              <p className="max-w-xs text-[10px] font-black uppercase leading-5 tracking-[0.2em] text-white/70">Teacher Portfolio / MindX Tech & AI School / 2026</p>
              <span className="grid h-12 w-12 place-items-center bg-[#f2c94c] text-sm font-black text-[#17324d]">04</span>
            </div>
            <div className="py-16 lg:py-24">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#f2c94c]">Giáo viên · Người dẫn dắt</p>
              <h1 className="mt-6 max-w-4xl text-[clamp(3.5rem,8vw,7.5rem)] font-black uppercase leading-[0.82] tracking-[-0.075em]">{data.profile.displayName}</h1>
              <p className="mt-8 max-w-2xl text-xl font-bold leading-8 text-white sm:text-2xl">{data.profile.professionalTitle}</p>
            </div>
            <a href={`#${nextSection}`} className="inline-flex w-fit items-center gap-3 border-b-2 border-[#f2c94c] pb-2 text-[10px] font-black uppercase tracking-[0.16em]">Xem hồ sơ năng lực <span aria-hidden="true">↘</span></a>
          </div>

          <div className="grid lg:col-span-5 lg:grid-rows-[1fr_auto]">
            <div className="relative min-h-[430px] overflow-hidden border-b-2 border-[#17324d] bg-[#17324d]">
              {data.profile.avatarUrl ? <Image src={data.profile.avatarUrl} alt={`Ảnh đại diện ${data.profile.displayName}`} fill sizes="(max-width: 1024px) 100vw, 520px" className="object-cover" unoptimized /> : <div className="grid h-full min-h-[430px] place-items-center text-8xl font-black text-[#f2c94c]">{teacherPortfolioInitials(data.profile.displayName)}</div>}
              <span className="absolute bottom-0 left-0 bg-[#f2c94c] px-5 py-3 text-[10px] font-black uppercase tracking-[0.17em] text-[#17324d]">Teacher / Mentor</span>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="border-b-2 border-[#17324d] p-5 sm:border-b-0 sm:border-r-2"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#bd0026]">Cơ sở</p><p className="mt-3 flex items-start gap-2 text-sm font-black"><Building2 className="mt-0.5 h-4 w-4 shrink-0" />{data.profile.centerName || 'MindX'}</p></div>
              <div className="p-5"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#bd0026]">Chuyên môn</p><p className="mt-3 text-sm font-black">{data.profile.courseLines.join(' · ') || 'Giáo dục công nghệ'}</p></div>
            </div>
          </div>
        </div>
      </section>

      {hasOperations ? (
        <section className="border-b-2 border-[#17324d]">
          <div className="mx-auto grid max-w-7xl border-x-2 border-[#17324d] grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => <article key={metric.label} className={`${index % 2 === 0 ? 'bg-[#bd0026] text-white' : 'bg-[#17324d] text-white'} relative min-h-44 border-white/20 p-5 sm:p-7 ${index % 2 ? 'border-l-2' : ''} ${index > 1 ? 'border-t-2 lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l-2' : ''}`}><metric.icon className="h-5 w-5 text-[#f2c94c]" /><p className="mt-8 text-5xl font-black tracking-[-0.06em]">{metric.value ?? '—'}</p><p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/65">{metric.label}</p>{demoOperations ? <span className="absolute right-3 top-3 h-2 w-2 bg-[#f2c94c]" aria-label="Dữ liệu minh họa" /> : null}</article>)}
          </div>
        </section>
      ) : null}

      {hasBackground ? (
        <section id="background" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <GridHeading index="01" kicker="Foundation" title="Nền tảng nghề nghiệp" />
            <div className="grid border-x-2 border-b-2 border-[#17324d] lg:grid-cols-2 lg:divide-x-2 lg:divide-[#17324d]">
              {data.education.length > 0 ? <div><div className="flex items-center gap-3 bg-[#17324d] px-5 py-4 text-white"><GraduationCap className="h-5 w-5 text-[#f2c94c]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Học vấn</h3></div>{data.education.map((item, index) => <article key={item.id} className="grid grid-cols-[52px_1fr] border-t-2 border-[#17324d]"><p className="bg-[#f2c94c] p-4 text-xl font-black text-[#17324d]">{String(index + 1).padStart(2, '0')}</p><div className="p-5"><h4 className="text-lg font-black">{item.institution}</h4><p className="mt-2 text-sm font-bold text-[#4f6171]">{item.qualification}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}</p><p className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#bd0026]">{item.startYear || '—'} — {item.endYear || 'Nay'}</p></div></article>)}</div> : null}
              {data.experiences.length > 0 ? <div><div className="flex items-center gap-3 bg-[#bd0026] px-5 py-4 text-white"><BriefcaseBusiness className="h-5 w-5 text-[#f2c94c]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Kinh nghiệm</h3></div>{data.experiences.map((item, index) => <article key={item.id} className="grid grid-cols-[52px_1fr] border-t-2 border-[#17324d]"><p className="bg-[#f2c94c] p-4 text-xl font-black text-[#17324d]">{String(index + 1).padStart(2, '0')}</p><div className="p-5"><h4 className="text-lg font-black">{item.jobTitle}</h4><p className="mt-2 text-sm font-bold text-[#4f6171]">{item.organization}</p><p className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#bd0026]">{formatTeacherPortfolioDate(item.startDate)} — {item.isCurrent ? 'Hiện tại' : formatTeacherPortfolioDate(item.endDate)}</p></div></article>)}</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {hasCredentials ? (
        <section id="credentials" className="scroll-mt-24 border-y-2 border-[#17324d] bg-[#17324d] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid md:grid-cols-[150px_1fr]"><div className="bg-[#f2c94c] p-5 text-[#17324d]"><p className="text-4xl font-black tracking-[-0.07em]">02</p><p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em]">Credentials</p></div><div className="flex items-center border-2 border-white px-5 py-7 md:px-8"><h2 className="text-3xl font-black uppercase leading-[0.96] tracking-[-0.05em] sm:text-5xl">Chứng chỉ & thành tích</h2></div></div>
            <div className="grid border-x-2 border-b-2 border-white lg:grid-cols-2 lg:divide-x-2 lg:divide-white">
              {certificates.length > 0 ? <div className="p-6"><div className="flex items-center justify-between gap-4 border-b border-white/30 pb-4"><div className="flex items-center gap-3"><Award className="h-5 w-5 text-[#f2c94c]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Chứng chỉ</h3></div>{demoCertificates ? <DemoMark>Minh họa</DemoMark> : null}</div>{certificates.map((item) => <article key={item.id} className="grid gap-3 border-b border-white/25 py-6 sm:grid-cols-[1fr_auto]"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#f2c94c]">{item.type}</p><h4 className="mt-2 text-lg font-black">{item.name}</h4></div><p className="text-xs font-bold text-white/55">{item.issueDate ? formatTeacherPortfolioDate(item.issueDate) : '—'}</p></article>)}</div> : null}
              {data.achievements.length > 0 ? <div className="border-t-2 border-white p-6 lg:border-t-0"><div className="flex items-center gap-3 border-b border-white/30 pb-4"><Medal className="h-5 w-5 text-[#f2c94c]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Giải thưởng & cuộc thi</h3></div>{data.achievements.map((item) => <article key={item.id} className="border-b border-white/25 py-6"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#f2c94c]">{item.category === 'competition' ? 'Cuộc thi' : 'Giải thưởng'}</p><h4 className="mt-2 text-lg font-black">{item.title}</h4><p className="mt-2 text-sm text-white/60">{[item.organization, item.level].filter(Boolean).join(' · ') || '—'}</p></article>)}</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {hasTraining ? (
        <section id="training" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <GridHeading index="03" kicker="Training Lab" title="Quá trình đào tạo tại MindX" />
            <div className="grid border-x-2 border-b-2 border-[#17324d] lg:grid-cols-3 lg:divide-x-2 lg:divide-[#17324d]">
              <article className="p-6"><div className="flex items-center justify-between"><CalendarDays className="h-6 w-6 text-[#bd0026]" />{demoOnboarding ? <DemoMark>Minh họa</DemoMark> : null}</div><p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em] text-[#bd0026]">Module A</p><h3 className="mt-2 text-2xl font-black">Đào tạo đầu vào</h3><div className="mt-6">{onboardingSessions.map((session) => <div key={session.id} className="grid grid-cols-[34px_1fr_auto] items-start gap-3 border-t-2 border-[#17324d] py-4"><p className="font-black text-[#bd0026]">{String(session.sessionNumber).padStart(2, '0')}</p><p className="text-sm font-bold">{session.title}</p><p className="text-xs font-black">{session.score ?? '—'}</p></div>)}</div></article>
              <article className="border-t-2 border-[#17324d] p-6 lg:border-t-0"><div className="flex items-center justify-between"><BookOpenCheck className="h-6 w-6 text-[#bd0026]" />{demoInternalTraining ? <DemoMark>Minh họa</DemoMark> : null}</div><p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em] text-[#bd0026]">Module B</p><h3 className="mt-2 text-2xl font-black">Training nội bộ</h3>{internalTraining.available ? <div className="mt-6 grid grid-cols-2 border-l-2 border-t-2 border-[#17324d]">{[['Video', `${internalTraining.videosCompleted ?? 0}/${internalTraining.totalVideosAssigned ?? 0}`], ['Tiến độ', trainingCompletion !== null ? `${trainingCompletion}%` : '—'], ['Điểm video', internalTraining.averageVideoScore ?? '—'], ['Điểm bài', internalTraining.averageAssignmentScore ?? '—']].map(([label, value], index) => <div key={label} className={`${index === 0 ? 'bg-[#bd0026] text-white' : index === 3 ? 'bg-[#f2c94c]' : 'bg-white'} border-b-2 border-r-2 border-[#17324d] p-4`}><p className="text-2xl font-black">{value}</p><p className={`mt-2 text-[9px] font-black uppercase tracking-[0.1em] ${index === 0 ? 'text-white/65' : 'text-[#596c7c]'}`}>{label}</p></div>)}</div> : <p className="mt-6 text-sm text-[#596c7c]">Chưa có dữ liệu.</p>}</article>
              <article className="border-t-2 border-[#17324d] p-6 lg:border-t-0"><div className="flex items-center justify-between"><Sparkles className="h-6 w-6 text-[#bd0026]" />{demoAdvancedTraining ? <DemoMark>Minh họa</DemoMark> : null}</div><p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em] text-[#bd0026]">Module C</p><h3 className="mt-2 text-2xl font-black">Chuyên sâu</h3>{advancedTraining.available ? <div className="mt-6"><div className="flex items-end justify-between border-t-2 border-[#17324d] py-5"><div><p className="text-sm font-black">Chuyên môn</p><p className="mt-1 text-xs text-[#596c7c]">{advancedTraining.expertiseRecords} lượt</p></div><p className="text-5xl font-black text-[#bd0026]">{advancedTraining.expertiseAverage ?? '—'}</p></div><div className="flex items-end justify-between border-y-2 border-[#17324d] py-5"><div><p className="text-sm font-black">Trải nghiệm</p><p className="mt-1 text-xs text-[#596c7c]">{advancedTraining.experienceRecords} lượt</p></div><p className="text-5xl font-black text-[#bd0026]">{advancedTraining.experienceAverage ?? '—'}</p></div></div> : <p className="mt-6 text-sm text-[#596c7c]">Chưa có dữ liệu.</p>}</article>
            </div>
            {trainingMedia.length > 0 ? <div className="mt-10 grid border-2 border-[#17324d] md:grid-cols-3">{trainingMedia.map((media, index) => <article key={media.id} className={`${index === 0 ? 'bg-[#bd0026] text-white' : index === 1 ? 'bg-[#17324d] text-white' : 'bg-[#f2c94c] text-[#17324d]'} min-h-56 p-6 md:border-l-2 md:first:border-l-0 md:border-white/25`}><div className="flex items-start justify-between"><p className="text-6xl font-black tracking-[-0.08em] opacity-25">0{index + 1}</p>{media.caption ? <CheckCircle2 className="h-5 w-5" /> : null}</div><h4 className="mt-12 text-xl font-black">{media.caption || 'Hoạt động đào tạo'}</h4><p className="mt-2 text-xs font-bold opacity-65">{media.sessionTitle || 'Teacher Training'}</p>{demoMedia ? <span className="mt-5 inline-flex text-[9px] font-black uppercase tracking-[0.13em]">Dữ liệu minh họa</span> : null}</article>)}</div> : null}
          </div>
        </section>
      ) : null}

      {hasJourney ? (
        <section id="journey" className="scroll-mt-24 border-t-2 border-[#17324d] bg-[#bd0026] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid border-2 border-white md:grid-cols-[150px_1fr]"><div className="bg-[#f2c94c] p-5 text-[#17324d]"><p className="text-4xl font-black tracking-[-0.07em]">04</p><p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em]">Impact</p></div><div className="flex items-center px-5 py-7 md:px-8"><h2 className="text-3xl font-black uppercase leading-[0.96] tracking-[-0.05em] sm:text-5xl">Tác động trong lớp học</h2></div></div>
            {hasOperations ? <div className="grid grid-cols-2 border-x-2 border-b-2 border-white lg:grid-cols-4">{metrics.map((metric, index) => <article key={metric.label} className={`p-5 ${index % 2 ? 'border-l-2 border-white/35' : ''} ${index > 1 ? 'border-t-2 border-white/35 lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l-2' : ''}`}><metric.icon className="h-5 w-5 text-[#f2c94c]" /><p className="mt-7 text-4xl font-black">{metric.value ?? '—'}</p><p className="mt-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/65">{metric.label}</p></article>)}</div> : null}
            {data.honors.length > 0 || demoStudentAwards.length > 0 || data.studentAchievements.available ? <div className="mt-10 grid border-2 border-white lg:grid-cols-2 lg:divide-x-2 lg:divide-white">{data.honors.length > 0 ? <div className="p-6"><div className="flex items-center gap-3 border-b border-white/35 pb-4"><Trophy className="h-5 w-5 text-[#f2c94c]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Vinh danh</h3></div>{data.honors.map((honor) => <article key={honor.id} className="border-b border-white/25 py-5"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#f2c94c]">{honor.month}</p><h4 className="mt-2 text-lg font-black">{honor.title}</h4>{honor.detail ? <p className="mt-2 text-sm text-white/65">{honor.detail}</p> : null}</article>)}</div> : null}<div className="border-t-2 border-white p-6 lg:border-t-0"><div className="flex items-center gap-3 border-b border-white/35 pb-4"><Award className="h-5 w-5 text-[#f2c94c]" /><h3 className="text-xs font-black uppercase tracking-[0.16em]">Thành tích học viên</h3></div>{demoStudentAwards.map((award) => <article key={award.title} className="border-b border-white/25 py-5"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#f2c94c]">{award.competition}</p><h4 className="mt-2 text-lg font-black">{award.title}</h4><p className="mt-2 text-sm text-white/65">{award.result}</p></article>)}{demoStudentAwards.length === 0 && data.studentAchievements.available ? <div className="py-6"><p className="text-6xl font-black text-[#f2c94c]">{data.studentAchievements.total ?? '—'}</p><p className="mt-2 text-sm text-white/65">Thành tích được ghi nhận trên TPS.</p></div> : null}</div></div> : null}
          </div>
        </section>
      ) : null}

      <footer className="border-t-2 border-[#17324d] bg-white px-5 py-12 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row sm:items-end"><div className="flex items-center gap-4"><Image src={logoTechAi} alt="MindX Tech & AI School" className="h-10 w-auto object-contain" /><span className="h-9 w-2 bg-[#bd0026]" /><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#17324d]">Teacher Portfolio · Academic Grid</p></div><p className="max-w-lg border-l-4 border-[#f2c94c] pl-4 text-xs font-bold leading-6 text-[#526575]">Hồ sơ công khai tập trung vào năng lực chuyên môn, quá trình đào tạo và tác động giảng dạy.</p></div></footer>
    </main>
  )
}
