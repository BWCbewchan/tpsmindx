'use client'

import {
  Award,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  GraduationCap,
  ImageOff,
  Link2,
  Loader2,
  Medal,
  PencilLine,
  Presentation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'

import { Button } from '@/components/ui/button'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import type {
  TeacherPortfolioDto,
  TeacherPortfolioProvenance,
  TeacherPortfolioTemplate,
} from '@/lib/teacher-portfolio/types'
import type { Teacher } from '@/types/teacher'
import TeacherPortfolioEditor from './teacher-portfolio/TeacherPortfolioEditor'

type TeacherPortfolioTabProps = {
  teacher: Teacher
}

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

function SourceBadge({ provenance }: { provenance: TeacherPortfolioProvenance }) {
  const verified = provenance.kind === 'verified'
  const synced = provenance.kind === 'tps_synced'
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : synced ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      {verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      {provenance.label}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[#d8cec2] bg-[#fbf8f3] px-4 py-6 text-center text-sm font-medium text-[#796e65]">{children}</div>
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: typeof Award
  title: string
  description: string
  badge: TeacherPortfolioProvenance
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-[#ebe3d9] pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2c2521] text-white"><Icon className="h-5 w-5" /></span>
        <div><h3 className="font-black tracking-tight text-[#2c2521]">{title}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-[#7b6d64]">{description}</p></div>
      </div>
      <SourceBadge provenance={badge} />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="h-52 animate-pulse rounded-3xl bg-gray-200" />
      <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  )
}

export default function TeacherPortfolioTab({ teacher }: TeacherPortfolioTabProps) {
  const { user, token } = useAuth()
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TeacherPortfolioTemplate>(1)
  const fetcher = async (url: string) => {
    let response: Response | null = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(url, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: authHeaders(token),
        })
        break
      } catch {
        if (attempt === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 350))
        }
      }
    }
    if (!response) {
      throw new Error('Không thể kết nối tới Teacher Portfolio. Vui lòng thử lại.')
    }
    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean
      data?: TeacherPortfolioDto
      error?: string
    }
    if (!response.ok || !result.data) throw new Error(result.error || 'Không thể tải Teacher Portfolio.')
    return result.data
  }
  const { data, error, isLoading, mutate } = useSWR<TeacherPortfolioDto>(
    user ? `/api/user/teacher-portfolio?code=${encodeURIComponent(teacher.code)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const selectedSharePath = useMemo(() => {
    if (!data) return ''
    return `${data.meta.sharePath}?template=${selectedTemplate}`
  }, [data, selectedTemplate])

  const shareUrl = useMemo(() => {
    if (!selectedSharePath || typeof window === 'undefined') return selectedSharePath
    return `${window.location.origin}${selectedSharePath}`
  }, [selectedSharePath])

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Đã sao chép link Teacher Portfolio.')
    } catch {
      toast.error('Không thể sao chép tự động. Hãy chọn và sao chép link bên dưới.')
    }
  }

  if (isLoading) return <LoadingState />
  if (error || !data) {
    return (
      <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:m-6">
        <p className="font-bold text-rose-800">{error instanceof Error ? error.message : 'Không thể tải Teacher Portfolio.'}</p>
        <Button className="mt-4" variant="outline" onClick={() => mutate()}><RefreshCw /> Thử lại</Button>
      </div>
    )
  }

  const training = data.training
  const operations = data.operations
  const selfSource: TeacherPortfolioProvenance = { kind: 'self_reported', label: 'GV tự cập nhật' }
  const overviewStats = [
    { icon: Presentation, label: 'Lớp đã dạy', value: operations.classCount as number | string | null },
    { icon: Users, label: 'Học viên', value: operations.studentCount as number | string | null },
    { icon: Clock3, label: 'Giờ giảng dạy', value: operations.teachingHours !== null ? `${operations.teachingHours}h` : null },
    ...(data.honors.length > 0
      ? [{ icon: Trophy, label: 'Vinh danh', value: data.honors.length as number | string | null }]
      : []),
  ]

  return (
    <div className="bg-[#f5f0e8] p-3 sm:p-5">
      <div className="relative overflow-hidden rounded-[26px] bg-[#201b18] px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="absolute inset-0 opacity-80 [background:radial-gradient(circle_at_90%_10%,rgba(189,0,38,.72),transparent_36%),radial-gradient(circle_at_10%_100%,rgba(200,155,75,.22),transparent_35%)]" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60"><span className="h-px w-8 bg-[#efc46e]" /> Teacher Portfolio</div>
            <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">{data.profile.displayName || teacher.name}</h2>
            <p className="mt-2 text-sm font-semibold text-white/70">{data.profile.professionalTitle}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {data.profile.centerName ? <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold"><Building2 className="h-3.5 w-3.5 text-[#efc46e]" />{data.profile.centerName}</span> : null}
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold"><ShieldCheck className="h-3.5 w-3.5 text-[#efc46e]" />Phân quyền theo cơ sở/khu vực</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.access.canEditSelfReported ? <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setEditorOpen(true)}><PencilLine /> Cập nhật Nhóm 1</Button> : null}
            <Button type="button" variant="mindx" onClick={copyLink}><Link2 /> Sao chép link</Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#dfd6ca] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#bd0026]/10 text-[#bd0026]"><Clipboard className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#8a7b70]">Link chia sẻ</p><input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full truncate bg-transparent text-sm font-semibold text-[#332b27] outline-none" aria-label="Link chia sẻ Teacher Portfolio" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center border border-[#d8cec2] bg-[#fbf8f3] p-0.5" role="group" aria-label="Chọn mẫu Teacher Portfolio">
              <span className="px-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#8a7b70]">Mẫu</span>
              {([1, 2, 3, 4] as const).map((template) => (
                <button
                  key={template}
                  type="button"
                  aria-pressed={selectedTemplate === template}
                  onClick={() => setSelectedTemplate(template)}
                  className={`grid h-7 min-w-7 place-items-center px-2 text-xs font-black transition-colors ${selectedTemplate === template ? 'bg-[#bd0026] text-white' : 'text-[#5f554d] hover:bg-[#eee7de]'}`}
                >
                  {template}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={copyLink}><Clipboard /> Copy</Button>
            <Button size="sm" variant="outline" asChild><a href={selectedSharePath} target="_blank" rel="noopener noreferrer"><ExternalLink /> Mở trang</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`${selectedSharePath}&demo=1`} target="_blank" rel="noopener noreferrer"><Sparkles /> Xem bản mẫu</a></Button>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">Link chia sẻ là trang công khai, bất kỳ ai có link đều xem được. Quyền cơ sở/khu vực chỉ áp dụng cho Leader khi tra cứu portfolio giáo viên trong TPS.</p>
      </div>

      {data.meta.demoSections.length > 0 ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">Tài khoản trình bày đang dùng dữ liệu minh họa cho: {data.meta.demoSections.map((section) => section === 'certificates' ? 'chứng chỉ' : section === 'onboarding' ? 'đào tạo đầu vào' : 'training nội bộ').join(', ')}. Các mục này chưa phải dữ liệu vận hành thật.</div> : null}

      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${data.honors.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {overviewStats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#e2d9cd] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a7b70]">{item.label}</p><p className="mt-2 text-2xl font-black text-[#2c2521]">{item.value ?? '—'}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#bd0026]/10 text-[#bd0026]"><item.icon className="h-4.5 w-4.5" /></span></div>
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-[#e2d9cd] bg-white p-4 shadow-sm sm:p-6">
        <SectionHeader icon={GraduationCap} title="Nhóm 1 · Trước khi vào MindX" description="Giáo viên tự khai học vấn, kinh nghiệm và giải thưởng. Chứng chỉ tiếp tục dùng chức năng có sẵn trong Hồ sơ cá nhân." badge={selfSource} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div><div className="mb-3 flex items-center gap-2"><GraduationCap className="h-4 w-4 text-[#bd0026]" /><h4 className="text-sm font-black">Học vấn</h4></div>{data.education.length ? <div className="space-y-3">{data.education.map((item) => <article key={item.id} className="rounded-xl border border-[#ebe3d9] bg-[#fbfaf7] p-4"><h5 className="text-sm font-black">{item.institution}</h5><p className="mt-1 text-xs font-semibold text-[#70655c]">{item.qualification}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}</p>{item.startYear || item.endYear ? <p className="mt-2 text-[11px] text-[#8a7d73]">{item.startYear || '—'} – {item.endYear || 'Nay'}</p> : null}</article>)}</div> : <Empty>Chưa cập nhật học vấn.</Empty>}</div>
          <div><div className="mb-3 flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-[#bd0026]" /><h4 className="text-sm font-black">Kinh nghiệm</h4></div>{data.experiences.length ? <div className="space-y-3">{data.experiences.map((item) => <article key={item.id} className="rounded-xl border border-[#ebe3d9] bg-[#fbfaf7] p-4"><h5 className="text-sm font-black">{item.jobTitle}</h5><p className="mt-1 text-xs font-semibold text-[#70655c]">{item.organization}</p><p className="mt-2 text-[11px] text-[#8a7d73]">{formatDate(item.startDate)} – {item.isCurrent ? 'Hiện tại' : formatDate(item.endDate)}</p></article>)}</div> : <Empty>Chưa cập nhật kinh nghiệm.</Empty>}</div>
          <div><div className="mb-3 flex items-center gap-2"><Medal className="h-4 w-4 text-[#bd0026]" /><h4 className="text-sm font-black">Giải thưởng & cuộc thi</h4></div>{data.achievements.length ? <div className="space-y-3">{data.achievements.map((item) => <article key={item.id} className="rounded-xl border border-[#ebe3d9] bg-[#fbfaf7] p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-wide text-[#bd0026]">{item.category === 'competition' ? 'Cuộc thi' : 'Giải thưởng'}</p><h5 className="mt-1 text-sm font-black">{item.title}</h5></div><SourceBadge provenance={item.provenance} /></div>{item.verificationStatus === 'pending' ? <p className="mt-2 text-[11px] font-semibold text-amber-700">Đang chờ Leader/TE duyệt minh chứng.</p> : null}</article>)}</div> : <Empty>Chưa cập nhật thành tích.</Empty>}</div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f3ed] p-4"><div><p className="text-sm font-black">Chứng chỉ chuyên môn</p><p className="mt-1 text-xs text-[#74685f]">Đang có {data.certificates.length} chứng chỉ. TPS tái sử dụng chức năng upload và quản lý chứng chỉ hiện có.</p></div><Button size="sm" variant="outline" asChild><Link href="/user/profile"><ExternalLink /> Quản lý chứng chỉ</Link></Button></div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#e2d9cd] bg-white p-4 shadow-sm sm:p-6">
        <SectionHeader icon={BookOpenCheck} title="Nhóm 2 · Quá trình đào tạo tại MindX" description="Tự động đồng bộ từ HR Onboarding, Training và kiểm tra chuyên sâu. Giáo viên không thể chỉnh sửa." badge={training.provenance} />
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl bg-[#f7f3ed] p-4"><CalendarDays className="h-5 w-5 text-[#bd0026]" /><h4 className="mt-3 text-sm font-black">Training đầu vào</h4><p className="mt-1 text-xs text-[#74685f]">{training.onboarding.genName || 'Chưa có Gen được liên kết'}</p>{training.onboarding.sessions.length ? <div className="mt-4 space-y-2">{training.onboarding.sessions.map((session) => <div key={session.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs"><CheckCircle2 className={`h-4 w-4 ${session.attendance ? 'text-emerald-600' : 'text-gray-300'}`} /><span className="min-w-0 flex-1 truncate font-semibold">Buổi {session.sessionNumber}: {session.title}</span><span className="font-black">{session.score ?? '—'}</span></div>)}</div> : null}</article>
          <article className="rounded-2xl bg-[#f7f3ed] p-4"><BookOpenCheck className="h-5 w-5 text-[#bd0026]" /><h4 className="mt-3 text-sm font-black">Training nội bộ</h4>{training.internal.available ? <div className="mt-4 grid grid-cols-2 gap-2">{[['Video', `${training.internal.videosCompleted ?? 0}/${training.internal.totalVideosAssigned ?? 0}`], ['Điểm video', training.internal.averageVideoScore ?? '—'], ['Bài đạt', `${training.internal.assignmentsPassed ?? 0}/${training.internal.assignmentsTaken ?? 0}`], ['Điểm bài', training.internal.averageAssignmentScore ?? '—']].map(([label, value]) => <div key={label} className="rounded-lg bg-white p-3"><p className="text-lg font-black">{value}</p><p className="text-[10px] font-bold text-[#82766c]">{label}</p></div>)}</div> : <p className="mt-3 text-xs text-[#74685f]">Chưa có dữ liệu training nội bộ.</p>}</article>
          <article className="rounded-2xl bg-[#f7f3ed] p-4"><Sparkles className="h-5 w-5 text-[#bd0026]" /><h4 className="mt-3 text-sm font-black">Kiểm tra chuyên sâu</h4>{training.advanced.available ? <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white p-3"><p className="text-2xl font-black">{training.advanced.expertiseAverage ?? '—'}</p><p className="text-[10px] font-bold text-[#82766c]">Chuyên sâu · {training.advanced.expertiseRecords} lượt</p></div><div className="rounded-lg bg-white p-3"><p className="text-2xl font-black">{training.advanced.experienceAverage ?? '—'}</p><p className="text-[10px] font-bold text-[#82766c]">Trải nghiệm · {training.advanced.experienceRecords} lượt</p></div></div> : <p className="mt-3 text-xs text-[#74685f]">Chưa có kết quả được đồng bộ.</p>}</article>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#d8cec2] bg-[#fbf8f3] p-4 text-xs text-[#74685f]"><ImageOff className="h-4 w-4 shrink-0 text-[#bd0026]" /> Ảnh training theo Session/Gen chưa có kho nguồn trên TPS nên chưa hiển thị.</div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#e2d9cd] bg-white p-4 shadow-sm sm:p-6">
        <SectionHeader icon={Presentation} title="Nhóm 3 · Quá trình làm việc" description="Tổng hợp từ dữ liệu vận hành và vinh danh. Theo yêu cầu, không đưa feedback và đánh giá từ BU vào portfolio." badge={operations.provenance} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          { icon: Presentation, label: 'Số lớp', value: operations.classCount },
          { icon: Users, label: 'Học viên', value: operations.studentCount },
          { icon: CalendarDays, label: 'Buổi dạy', value: operations.classSessions },
          { icon: Clock3, label: 'Giờ giảng dạy', value: operations.teachingHours !== null ? `${operations.teachingHours}h` : null },
        ].map((item) => <div key={item.label} className="rounded-xl border border-[#ebe3d9] bg-[#fbfaf7] p-4"><item.icon className="h-4 w-4 text-[#bd0026]" /><p className="mt-3 text-2xl font-black">{item.value ?? '—'}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#82766c]">{item.label}</p></div>)}</div>
        <div className={`mt-4 grid gap-4 ${data.honors.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {data.honors.length > 0 ? <div className="rounded-xl bg-[#f7f3ed] p-4"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-[#bd0026]" /><h4 className="text-sm font-black">Vinh danh tháng</h4></div><div className="mt-3 space-y-2">{data.honors.map((honor) => <div key={honor.id} className="rounded-lg bg-white p-3"><p className="text-xs font-black">{honor.title}</p><p className="mt-1 text-[11px] text-[#82766c]">{honor.month || 'Chưa có tháng'}{honor.detail ? ` · ${honor.detail}` : ''}</p></div>)}</div></div> : null}
          <div className="rounded-xl bg-[#f7f3ed] p-4"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-[#bd0026]" /><h4 className="text-sm font-black">Học viên đạt giải</h4></div><p className="mt-3 text-xs leading-5 text-[#74685f]">Sẽ tự động hiển thị khi form đề xuất thưởng được chuyển từ Google Sheet lên TPS.</p></div>
          <div className="rounded-xl bg-[#f7f3ed] p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#bd0026]" /><h4 className="text-sm font-black">CPR & retention</h4></div><p className="mt-3 text-xs leading-5 text-[#74685f]">Chưa có nguồn teacher-specific chuẩn. TPS không sử dụng số liệu của Leader để thay thế.</p></div>
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-[#dfd6ca] bg-[#fbf8f3] p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#8a7b70]">Nguyên tắc hiển thị</p><ul className="mt-3 grid gap-2 text-xs leading-5 text-[#74685f] md:grid-cols-3">{data.sourceNotes.map((note) => <li key={note} className="rounded-xl bg-white p-3">{note}</li>)}</ul></div>

      {editorOpen ? (
        <TeacherPortfolioEditor
          key={`${data.meta.updatedAt}-${editorOpen}`}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          data={data}
          token={token}
          onSaved={(saved) => {
            void mutate(saved, false)
            toast.success('Đã lưu Teacher Portfolio.')
          }}
        />
      ) : null}
    </div>
  )
}
