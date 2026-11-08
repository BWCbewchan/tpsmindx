import {
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Presentation,
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

type CaseStudyViewProps = {
  data: TeacherPortfolioDto
  demoMode: boolean
  presentation: TeacherPortfolioPresentation
}

function CaseHeading({ number, eyebrow, title, description }: { number: string; eyebrow: string; title: string; description: string }) {
  return (
    <div className="border-t-4 border-[#DC2626] pt-6">
      <div className="grid gap-6 md:grid-cols-[140px_1fr]">
        <div>
          <p className="text-4xl font-black tracking-[-0.06em] text-[#DC2626]">{number}</p>
          <p className="mt-3 inline-flex bg-[#FEF3C7] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.17em] text-[#0F172A]">{eyebrow}</p>
        </div>
        <div><h2 className="text-3xl font-black leading-tight tracking-[-0.045em] text-[#0F172A] sm:text-5xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{description}</p></div>
      </div>
    </div>
  )
}

function EvidenceLabel({ children }: { children: React.ReactNode }) {
  return <p className="inline-flex border-l-4 border-[#F59E0B] pl-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#DC2626]">{children}</p>
}

export function TeacherPortfolioCaseStudyView({ data, demoMode: _demoMode, presentation }: CaseStudyViewProps) {
  const {
    certificates,
    onboardingSessions,
    internalTraining,
    advancedTraining,
    displayOperations,
    demoCertificates,
    demoOnboarding,
    demoInternalTraining,
    demoAdvancedTraining,
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
    { icon: Presentation, value: displayOperations.classCount, label: 'Lớp đã phụ trách' },
    { icon: Users, value: displayOperations.studentCount, label: 'Học viên đồng hành' },
    { icon: CalendarDays, value: displayOperations.classSessions, label: 'Buổi giảng dạy' },
    { icon: Clock3, value: displayOperations.teachingHours !== null ? `${displayOperations.teachingHours}h` : null, label: 'Thời lượng đứng lớp' },
  ]
  const hasRecognition = data.honors.length > 0 || demoStudentAwards.length > 0 || data.studentAchievements.available
  const visibleSections = sections.filter((section) => section.id !== 'journey' || hasRecognition)

  return (
    <main className="portfolio-theme min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherPortfolioProgressRail sections={visibleSections} themeColor="#DC2626" />

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="#profile" className="flex min-w-0 items-center gap-4">
            <Image src={logoTechAi} alt="MindX Tech & AI School" className="h-9 w-auto shrink-0 object-contain sm:h-11" priority />
            <div className="hidden border-l border-slate-300 pl-4 sm:block"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0F172A]">Hồ sơ năng lực giáo viên</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Professional Case Study</p></div>
          </a>
          <div className="flex items-center gap-2"><PortfolioPdfDownloadButton /><PortfolioMobileMenu sections={visibleSections} themeColor="#DC2626" /></div>
        </div>
      </header>

      <section id="profile" className="scroll-mt-20 border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[350px_1fr] lg:items-center">
          <div className="animate-fade-in-up relative mx-auto w-full max-w-[350px] lg:mx-0">
            <div className="absolute -left-4 -top-4 h-24 w-24 bg-[#F59E0B]" aria-hidden="true" />
            <div className="relative aspect-[4/5] overflow-hidden border border-slate-300 bg-slate-200">
              {data.profile.avatarUrl ? <Image src={data.profile.avatarUrl} alt={`Ảnh đại diện ${data.profile.displayName}`} fill sizes="(max-width: 1024px) 90vw, 350px" className="object-cover transition-transform duration-700 hover:scale-[1.04]" unoptimized /> : <div className="grid h-full place-items-center bg-[#0F172A] text-7xl font-black text-[#F59E0B]">{teacherPortfolioInitials(data.profile.displayName)}</div>}
            </div>
            <div className="absolute -bottom-4 right-0 flex h-9 w-36 items-center justify-center bg-[#DC2626] text-[9px] font-black uppercase tracking-[0.16em] text-white">Teacher / Mentor</div>
          </div>
          <div>
            <div className="animate-fade-in-up inline-flex items-center gap-3 border border-slate-200 bg-white px-3 py-2 shadow-[4px_4px_0_#F59E0B]"><span className="h-2 w-8 bg-[#DC2626]" /><p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Professional profile</p></div>
            <h1 className="animate-fade-in-up animation-delay-200 mt-7 max-w-4xl text-[clamp(3.2rem,6.8vw,6.4rem)] font-black leading-[0.9] tracking-[-0.065em] text-[#0F172A]">{data.profile.displayName}</h1>
            <p className="animate-fade-in-up animation-delay-300 mt-7 max-w-3xl text-xl font-semibold leading-8 text-slate-600 sm:text-2xl">{data.profile.professionalTitle}</p>
            <div className="animate-fade-in-up animation-delay-400 mt-10 grid gap-5 border-y border-slate-300 py-6 sm:grid-cols-2">
              {data.profile.centerName ? <div><EvidenceLabel>Đơn vị</EvidenceLabel><p className="mt-3 flex items-center gap-2 text-sm font-bold"><Building2 className="h-4 w-4 text-[#DC2626]" />{data.profile.centerName}</p></div> : null}
              {data.profile.courseLines.length > 0 ? <div><EvidenceLabel>Chuyên môn</EvidenceLabel><p className="mt-3 text-sm font-bold">{data.profile.courseLines.join(' · ')}</p></div> : null}
            </div>
          </div>
        </div>
      </section>

      {hasOperations ? <section className="border-b border-red-700 bg-[#DC2626] text-white"><div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">{metrics.map((metric, index) => <div key={metric.label} className={`relative px-4 py-9 ${index % 2 ? 'border-l border-red-400/50' : ''} ${index > 1 ? 'border-t border-red-400/50 lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l' : ''}`}><metric.icon className="h-5 w-5 text-[#FDE68A]" /><p className="mt-6 text-4xl font-black tracking-[-0.045em]">{metric.value ?? '—'}</p><p className="mt-2 text-[9px] font-black uppercase tracking-[0.15em] text-red-100">{metric.label}</p>{demoOperations ? <span className="absolute right-3 top-3 h-1.5 w-1.5 bg-[#F59E0B]" aria-label="Dữ liệu minh họa" /> : null}</div>)}</div></section> : null}

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 xl:grid-cols-[220px_1fr] xl:gap-16">
        <aside className="hidden xl:block print:hidden"><div className="sticky top-28 border-t-4 border-[#0F172A] pt-5"><p className="inline-flex bg-[#F59E0B] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#0F172A]">Mục lục hồ sơ</p><nav className="mt-5" aria-label="Mục lục hồ sơ">{visibleSections.slice(1).map((section, index) => <a key={section.id} href={`#${section.id}`} className="grid grid-cols-[26px_1fr] gap-3 border-b border-slate-300 py-4 text-xs font-bold text-slate-600 transition-all duration-300 hover:translate-x-1 hover:text-[#DC2626]"><span className="text-[10px] text-[#DC2626]">{String(index + 1).padStart(2, '0')}</span>{section.label}</a>)}</nav></div></aside>

        <div className="min-w-0 space-y-24 sm:space-y-32">
          {hasBackground ? <section id="background" className="scroll-mt-24"><CaseHeading number="01" eyebrow="Professional foundation" title="Nền tảng chuyên môn." description="Học vấn và kinh nghiệm được trình bày như phần nền của hồ sơ năng lực, ưu tiên khả năng tra cứu và đối chiếu." /><div className="mt-12 grid gap-12 lg:grid-cols-2">{data.education.length > 0 ? <div><div className="flex items-center gap-3 border-b-2 border-[#DC2626] pb-4"><GraduationCap className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.14em]">Học vấn</h3></div>{data.education.map((item) => <article key={item.id} className="border-b border-slate-300 bg-white px-5 py-6"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h4 className="font-black">{item.institution}</h4><p className="mt-2 text-sm font-semibold text-slate-600">{item.qualification}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}</p></div><p className="text-xs font-bold text-slate-500">{item.startYear || '—'}—{item.endYear || 'Nay'}</p></div>{item.description ? <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p> : null}</article>)}</div> : null}{data.experiences.length > 0 ? <div><div className="flex items-center gap-3 border-b-2 border-[#0F172A] pb-4"><BriefcaseBusiness className="h-5 w-5 text-[#0F172A]" /><h3 className="text-xs font-black uppercase tracking-[0.14em]">Kinh nghiệm</h3></div>{data.experiences.map((item) => <article key={item.id} className="border-b border-slate-300 bg-white px-5 py-6"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h4 className="font-black">{item.jobTitle}</h4><p className="mt-2 text-sm font-semibold text-[#DC2626]">{item.organization}</p></div><p className="text-xs font-bold text-slate-500">{formatTeacherPortfolioDate(item.startDate)}—{item.isCurrent ? 'Hiện tại' : formatTeacherPortfolioDate(item.endDate)}</p></div>{item.description ? <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p> : null}</article>)}</div> : null}</div></section> : null}

          {hasCredentials ? <section id="credentials" className="scroll-mt-24"><CaseHeading number="02" eyebrow="Credentials appendix" title="Chứng chỉ & thành tích." description="Danh mục bằng chứng chuyên môn được chuẩn hóa theo loại, đơn vị và thời điểm ghi nhận." /><div className="mt-12 border-y border-slate-400 bg-white"><div className="hidden grid-cols-[100px_1.2fr_.8fr_140px] gap-4 border-b border-slate-300 bg-[#0F172A] px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-white md:grid"><span>Loại</span><span>Nội dung</span><span>Đơn vị / cấp độ</span><span>Thời điểm</span></div>{certificates.map((item) => <article key={`certificate-${item.id}`} className="grid gap-3 border-b border-slate-200 px-5 py-5 md:grid-cols-[100px_1.2fr_.8fr_140px] md:gap-4"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#DC2626]">Chứng chỉ</p><h4 className="font-black">{item.name}</h4><p className="text-sm text-slate-600">{item.type}</p><p className="text-xs font-bold text-slate-500">{item.issueDate ? formatTeacherPortfolioDate(item.issueDate) : '—'}</p></article>)}{data.achievements.map((item) => <article key={`achievement-${item.id}`} className="grid gap-3 border-b border-slate-200 px-5 py-5 last:border-b-0 md:grid-cols-[100px_1.2fr_.8fr_140px] md:gap-4"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-600">{item.category === 'competition' ? 'Cuộc thi' : 'Giải thưởng'}</p><h4 className="font-black">{item.title}</h4><p className="text-sm text-slate-600">{[item.organization, item.level].filter(Boolean).join(' · ') || '—'}</p><p className="text-xs font-bold text-slate-500">{item.achievedOn ? formatTeacherPortfolioDate(item.achievedOn) : '—'}</p></article>)}</div>{demoCertificates ? <p className="mt-3 inline-flex bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold text-amber-900">Một phần chứng chỉ đang dùng dữ liệu minh họa.</p> : null}</section> : null}

          {hasTraining ? <section id="training" className="scroll-mt-24"><CaseHeading number="03" eyebrow="Case study 01" title="Mức độ sẵn sàng giảng dạy." description="Từ onboarding đến đào tạo nội bộ và kiểm tra chuyên sâu, dữ liệu được tổ chức theo bối cảnh, bằng chứng và kết quả." /><div className="mt-12 grid border-y border-slate-400 bg-white lg:grid-cols-[.9fr_1.2fr_1fr] lg:divide-x lg:divide-slate-300"><article className="p-6"><EvidenceLabel>Bối cảnh</EvidenceLabel><h3 className="mt-4 text-xl font-black">Đào tạo đầu vào</h3><p className="mt-3 text-sm leading-7 text-slate-600">{data.training.onboarding.genName || (demoOnboarding ? 'Gen Teacher Onboarding 2026' : 'Chưa xác định Gen')}</p><div className="mt-6">{onboardingSessions.map((session) => <div key={session.id} className="border-t border-slate-200 py-4"><p className="text-sm font-bold">Buổi {session.sessionNumber} · {session.title}</p><p className="mt-2 flex items-center gap-2 text-xs text-slate-500">{session.attendance ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}{session.score !== null ? `${session.score} điểm` : 'Chưa có điểm'}</p></div>)}</div></article><article className="border-t border-slate-300 p-6 lg:border-t-0"><EvidenceLabel>Bằng chứng</EvidenceLabel><h3 className="mt-4 text-xl font-black">Training nội bộ</h3>{internalTraining.available ? <div className="mt-6 grid grid-cols-2 border-l border-t border-slate-300">{[['Video hoàn thành', `${internalTraining.videosCompleted ?? 0}/${internalTraining.totalVideosAssigned ?? 0}`], ['Tiến độ', trainingCompletion !== null ? `${trainingCompletion}%` : '—'], ['Điểm video TB', internalTraining.averageVideoScore ?? '—'], ['Điểm bài TB', internalTraining.averageAssignmentScore ?? '—']].map(([label, value], index) => <div key={label} className={`${index === 0 ? 'bg-[#0F172A] text-white' : index === 3 ? 'bg-[#FEF3C7]' : ''} border-b border-r border-slate-300 p-4`}><p className="text-2xl font-black">{value}</p><p className={`mt-2 text-[9px] font-black uppercase tracking-[0.1em] ${index === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p></div>)}</div> : <p className="mt-5 text-sm text-slate-500">Chưa có dữ liệu nội bộ.</p>}</article><article className="border-t border-slate-300 p-6 lg:border-t-0"><EvidenceLabel>Kết quả</EvidenceLabel><h3 className="mt-4 text-xl font-black">Kiểm tra chuyên sâu</h3>{advancedTraining.available ? <div className="mt-6"><div className="flex items-end justify-between border-t border-slate-300 py-5"><div><p className="text-sm font-bold">Chuyên môn</p><p className="mt-1 text-xs text-slate-500">{advancedTraining.expertiseRecords} lượt</p></div><p className="text-4xl font-black text-[#DC2626]">{advancedTraining.expertiseAverage ?? '—'}</p></div><div className="flex items-end justify-between border-y border-slate-300 py-5"><div><p className="text-sm font-bold">Trải nghiệm</p><p className="mt-1 text-xs text-slate-500">{advancedTraining.experienceRecords} lượt</p></div><p className="text-4xl font-black text-[#DC2626]">{advancedTraining.experienceAverage ?? '—'}</p></div></div> : <p className="mt-5 text-sm text-slate-500">Chưa có dữ liệu chuyên sâu.</p>}</article></div>{demoOnboarding || demoInternalTraining || demoAdvancedTraining ? <p className="mt-3 inline-flex bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold text-amber-900">Case study có sử dụng dữ liệu minh họa ở nguồn chưa được liên kết.</p> : null}</section> : null}

          {hasRecognition ? (
            <section id="journey" className="scroll-mt-24">
              <CaseHeading number="04" eyebrow="Case study 02" title="Thành tích & dấu ấn." description="Các kết quả nổi bật được trình bày như phần kết luận của hồ sơ năng lực, không lặp lại nhóm chỉ số vận hành phía trên." />
              <div className="mt-12 grid gap-12 lg:grid-cols-2">
                {data.honors.length > 0 ? <div><div className="flex items-center gap-3 border-b-2 border-[#DC2626] pb-4"><Trophy className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.14em]">Vinh danh</h3></div>{data.honors.map((honor) => <article key={honor.id} className="grid gap-3 border-b border-slate-300 bg-white px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:grid-cols-[110px_1fr]"><p className="text-[10px] font-black uppercase text-[#DC2626]">{honor.month}</p><div><h4 className="font-black">{honor.title}</h4>{honor.detail ? <p className="mt-2 text-sm text-slate-600">{honor.detail}</p> : null}</div></article>)}</div> : null}
                <div className={data.honors.length > 0 ? '' : 'lg:col-span-2'}><div className="flex items-center gap-3 border-b-2 border-[#0F172A] pb-4"><Award className="h-5 w-5 text-[#DC2626]" /><h3 className="text-xs font-black uppercase tracking-[0.14em]">Thành tích học viên</h3></div><div className="grid md:grid-cols-2">{demoStudentAwards.map((award, index) => <article key={award.title} className="border-b border-slate-300 bg-white px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"><p className={`text-[9px] font-black uppercase tracking-[0.14em] ${index % 2 ? 'text-amber-600' : 'text-[#DC2626]'}`}>{award.competition}</p><h4 className="mt-2 font-black">{award.title}</h4><p className="mt-2 text-sm text-slate-600">{award.result}</p></article>)}{demoStudentAwards.length === 0 && data.studentAchievements.available ? <div className="border-b border-slate-300 bg-white px-5 py-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"><p className="text-5xl font-black text-[#DC2626]">{data.studentAchievements.total ?? '—'}</p><p className="mt-2 text-sm text-slate-600">Thành tích được ghi nhận trên TPS.</p></div> : null}</div></div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="border-t-[8px] border-[#DC2626] bg-white px-5 py-12 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row sm:items-end"><div className="flex items-center gap-4"><Image src={logoTechAi} alt="MindX Tech & AI School" className="h-10 w-auto object-contain" /><span className="h-9 w-2 bg-[#F59E0B]" /><div><p className="text-[10px] font-black uppercase tracking-[0.14em]">Teacher Portfolio</p><p className="mt-1 text-[9px] text-slate-500">Evidence-led profile</p></div></div><p className="max-w-lg text-xs leading-6 text-slate-600">Hồ sơ công khai tập trung vào nền tảng chuyên môn, quá trình đào tạo và bằng chứng giảng dạy; không hiển thị thông tin cá nhân riêng tư.</p></div></footer>
    </main>
  )
}
