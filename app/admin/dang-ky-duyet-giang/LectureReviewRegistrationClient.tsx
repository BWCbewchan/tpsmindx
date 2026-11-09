'use client'

import { PageHeader } from '@/components/PageHeader'
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/lecture-review/SearchableSelect'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/lib/app-toast'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CircleDot,
  FileText,
  Loader2,
  Search,
  Send,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import Link from 'next/link'
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type Leader = {
  code: string
  full_name: string
  role_code: string
  email: string | null
}

type Center = {
  id: number
  region: string | null
  short_code: string | null
  full_name: string
  display_name: string | null
}

type Candidate = {
  code: string
  full_name: string
  center_name: string | null
  manager_name: string | null
}

const REVIEWERS = [
  'Thầy Hoàng Việt Hùng',
  'Thầy Cao Quang Sơn',
  'Thầy Trần Văn Nghĩa',
  'Thầy Phạm Tiến Thịnh',
]

const TEACHING_BLOCKS = [
  { value: 'coding', label: 'Coding', detail: 'C4K, C4T' },
  { value: 'art', label: 'Art', detail: 'XART' },
  { value: 'robotics', label: 'Robotics', detail: 'ROB' },
  { value: 'age_4_plus', label: '4+', detail: 'KIND / ROB4' },
]

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ACCEPTED_EXTENSIONS = /\.(pdf|ppt|pptx|odp)$/i

function normalizeLookup(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-800">
      {children}
      <span className="text-[#b00020]">*</span>
    </div>
  )
}

function RadioTile({
  checked,
  label,
  description,
  onSelect,
}: {
  checked: boolean
  label: string
  description?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-lg border bg-white px-3 py-3 text-left transition-colors',
        checked
          ? 'border-[#b00020] bg-[#fff7f8] shadow-sm'
          : 'border-gray-200 hover:border-[#f0a8b3] hover:bg-[#fffafb]',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-[#b00020] bg-[#b00020]' : 'border-gray-300 bg-white',
        )}
      >
        {checked ? <CircleDot className="h-3.5 w-3.5 text-white" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
        ) : null}
      </span>
    </button>
  )
}

export function LectureReviewRegistrationClient() {
  const { token, isLoading: authLoading } = useAuth()
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittingStage, setSubmittingStage] = useState('')
  const [leaderCode, setLeaderCode] = useState('')
  const [centerId, setCenterId] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [lmsCode, setLmsCode] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [teachingBlock, setTeachingBlock] = useState('')
  const [material, setMaterial] = useState<File | null>(null)
  const [candidateResults, setCandidateResults] = useState<Candidate[]>([])
  const [candidateSearch, setCandidateSearch] = useState<{
    field: 'lms'
    query: string
  } | null>(null)
  const [searchingCandidates, setSearchingCandidates] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    setLoadingOptions(true)
    fetch('/api/lecture-review-applications/options', {
      cache: 'no-store',
      headers: authHeaders(token),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Không thể tải dữ liệu đăng ký')
        }
        return payload.data as { leaders: Leader[]; centers: Center[] }
      })
      .then((data) => {
        setLeaders(data.leaders || [])
        setCenters(data.centers || [])
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Không thể tải dữ liệu')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false)
      })
    return () => controller.abort()
  }, [authLoading, token])

  const applyCandidate = useCallback(
    (candidate: Candidate) => {
      setCandidateName(candidate.full_name)
      setLmsCode(candidate.code)

      const managerKey = normalizeLookup(candidate.manager_name)
      const matchingLeader = managerKey
        ? leaders.find(
            (leader) => normalizeLookup(leader.full_name) === managerKey,
          )
        : undefined
      setLeaderCode(matchingLeader?.code || '')

      const centerTokens = String(candidate.center_name || '')
        .split(/[,;|]+/)
        .map(normalizeLookup)
        .filter(Boolean)
      const matchingCenter = centers.find((center) => {
        const aliases = [center.full_name, center.display_name]
          .map(normalizeLookup)
          .filter((alias) => alias.length >= 4)
        return centerTokens.some((token) =>
          aliases.some(
            (alias) =>
              token === alias || token.includes(alias) || alias.includes(token),
          ),
        )
      })
      setCenterId(matchingCenter ? String(matchingCenter.id) : '')
    },
    [centers, leaders],
  )

  useEffect(() => {
    const query = candidateSearch?.query.trim() || ''
    if (!query) {
      setCandidateResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchingCandidates(true)
      fetch(
        `/api/lecture-review-applications/options?candidate=${encodeURIComponent(query)}`,
        {
          cache: 'no-store',
          headers: authHeaders(token),
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          const payload = await response.json()
          if (!response.ok || !payload.success) throw new Error(payload.error)
          return (payload.data?.candidates || []) as Candidate[]
        })
        .then((candidates) => {
          setCandidateResults(candidates)
          const exact = candidates.find(
            (candidate) =>
              candidate.code.toLowerCase() === query.toLowerCase(),
          )
          if (exact) {
            applyCandidate(exact)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setCandidateResults([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchingCandidates(false)
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [applyCandidate, candidateSearch, token])

  const leaderOptions = useMemo<SearchableSelectOption[]>(
    () =>
      leaders.map((leader) => ({
        value: leader.code,
        label: leader.full_name,
      })),
    [leaders],
  )
  const centerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      centers.map((center) => ({
        value: String(center.id),
        label: center.full_name,
      })),
    [centers],
  )

  function selectCandidate(candidate: Candidate) {
    applyCandidate(candidate)
    setCandidateResults([])
    setCandidateSearch(null)
  }

  function chooseFile(file: File | null) {
    if (!file) return
    if (!ACCEPTED_EXTENSIONS.test(file.name)) {
      toast.error('Chỉ hỗ trợ tệp PDF, PPT, PPTX hoặc ODP')
      return
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      toast.error('Kích thước tệp tối đa là 100 MB')
      return
    }
    setMaterial(file)
  }

  function resetForm() {
    setLeaderCode('')
    setCenterId('')
    setCandidateName('')
    setLmsCode('')
    setReviewDate('')
    setReviewerName('')
    setTeachingBlock('')
    setMaterial(null)
    setCandidateResults([])
    setCandidateSearch(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !leaderCode ||
      !centerId ||
      !candidateName.trim() ||
      !lmsCode.trim() ||
      !reviewDate ||
      !reviewerName ||
      !teachingBlock ||
      !material
    ) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc')
      return
    }

    setSubmitting(true)
    setSubmittingStage('Đang chuẩn bị tài liệu...')
    try {
      const contentType = material.type || 'application/octet-stream'
      const uploadInitResponse = await fetch(
        '/api/lecture-review-applications/upload-url',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token),
          },
          body: JSON.stringify({
            fileName: material.name,
            contentType,
            fileSize: material.size,
          }),
        },
      )
      const uploadInitPayload = await uploadInitResponse.json().catch(() => ({}))
      if (!uploadInitResponse.ok || !uploadInitPayload.success) {
        throw new Error(uploadInitPayload.error || 'Không thể chuẩn bị tải tài liệu')
      }

      const upload = uploadInitPayload.data as {
        uploadUrl: string
        bucket: string
        key: string
        headers: Record<string, string>
        fileName: string
        contentType: string
        fileSize: number
      }
      setSubmittingStage('Đang tải slide lên Supabase...')
      const storageResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers,
        body: material,
      })
      if (!storageResponse.ok) {
        throw new Error('Không thể tải slide lên Supabase Storage')
      }

      setSubmittingStage('Đang lưu phiếu đăng ký...')
      const response = await fetch('/api/lecture-review-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          leaderCode,
          centerId,
          candidateName: candidateName.trim(),
          lmsCode: lmsCode.trim(),
          reviewDate,
          reviewerName,
          teachingBlock,
          material: {
            bucket: upload.bucket,
            key: upload.key,
            fileName: upload.fileName,
            contentType: upload.contentType,
            fileSize: upload.fileSize,
          },
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Không thể gửi phiếu đăng ký')
      }
      toast.success('Đã gửi phiếu đăng ký duyệt giảng')
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi phiếu đăng ký')
    } finally {
      setSubmitting(false)
      setSubmittingStage('')
    }
  }

  const candidateDropdown = candidateSearch && candidateResults.length > 0

  return (
    <PageLayout
      background="white"
      maxWidth="full"
      padding="responsive"
      className="bg-[radial-gradient(circle_at_top_right,rgba(176,0,32,0.08),transparent_32rem)] px-4 sm:px-6 lg:px-8"
    >
      <PageLayoutContent spacing="xl" className="min-w-0 pb-24">
        <PageHeader
          title="Đăng Ký Duyệt Giảng"
          description="Hoàn thiện thông tin ứng viên và gửi tài liệu duyệt giảng trong một bước."
          actions={
            <Link
              href="/admin/quan-ly-dang-ky-duyet-giang"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#b00020]/20 bg-white px-4 text-sm font-bold text-[#a3001d] shadow-sm transition hover:border-[#b00020]/40 hover:bg-[#fff7f8]"
            >
              Quản lý đăng ký
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <form onSubmit={handleSubmit} className="w-full space-y-5">
            <section className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-42px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#b00020] text-white shadow-lg shadow-[#b00020]/20">
                    <UsersRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">Thông tin quản lý & ứng viên</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Nhập mã LMS để tự động điền tên ứng viên, Leader/TE và cơ sở.</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
                <div className="relative">
                  <FieldLabel>Mã LMS</FieldLabel>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={lmsCode}
                      onFocus={() => {
                        if (lmsCode) setCandidateSearch({ field: 'lms', query: lmsCode })
                      }}
                      onChange={(event) => {
                        const value = event.target.value
                        setLmsCode(value)
                        setCandidateName('')
                        setLeaderCode('')
                        setCenterId('')
                        setCandidateSearch({ field: 'lms', query: value })
                      }}
                      placeholder="VD: daitk"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#b00020] focus:ring-4 focus:ring-[#b00020]/10"
                    />
                    {searchingCandidates && candidateSearch?.field === 'lms' ? (
                      <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#b00020]" />
                    ) : null}
                  </div>
                  {candidateDropdown && candidateSearch.field === 'lms' ? (
                    <CandidateDropdown candidates={candidateResults} onSelect={selectCandidate} />
                  ) : null}
                </div>

                <div className="relative">
                  <FieldLabel>Họ và tên ứng viên</FieldLabel>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={candidateName}
                      onFocus={() => {
                        setCandidateSearch(null)
                        setCandidateResults([])
                      }}
                      onChange={(event) => setCandidateName(event.target.value)}
                      placeholder="Tên sẽ tự điền theo mã LMS"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#b00020] focus:ring-4 focus:ring-[#b00020]/10"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Leader/TE quản lý</FieldLabel>
                  <SearchableSelect
                    value={leaderCode}
                    onChange={setLeaderCode}
                    options={leaderOptions}
                    placeholder={loadingOptions ? 'Đang tải...' : 'Tự điền theo mã LMS'}
                    searchPlaceholder="Tìm theo tên..."
                    disabled={loadingOptions}
                  />
                </div>
                <div>
                  <FieldLabel>Cơ sở</FieldLabel>
                  <SearchableSelect
                    value={centerId}
                    onChange={setCenterId}
                    options={centerOptions}
                    placeholder={loadingOptions ? 'Đang tải...' : 'Tự điền theo mã LMS'}
                    searchPlaceholder="Tìm kiếm cơ sở..."
                    disabled={loadingOptions}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.45)] sm:p-7">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Lịch & giám khảo</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Chọn ngày duyệt giảng và người đánh giá.</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="max-w-sm">
                  <FieldLabel>Ngày đăng ký duyệt giảng</FieldLabel>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(event) => setReviewDate(event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#b00020] focus:ring-4 focus:ring-[#b00020]/10"
                  />
                </div>
                <div>
                  <FieldLabel>Giám khảo đánh giá</FieldLabel>
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Giám khảo đánh giá">
                    {REVIEWERS.map((reviewer) => {
                      const checked = reviewerName === reviewer
                      return (
                        <RadioTile
                          key={reviewer}
                          checked={checked}
                          label={reviewer}
                          onSelect={() => setReviewerName(reviewer)}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.45)] sm:p-7">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Tài liệu & khối giảng dạy</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Chuẩn bị slide đúng khối và thời lượng đánh giá.</p>
                </div>
              </div>

              <FieldLabel>Tài liệu duyệt giảng</FieldLabel>
              <p className="mb-3 text-sm text-slate-600">Slide duyệt giảng đáp ứng thời lượng 30 phút.</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.ppt,.pptx,.odp"
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0] || null)}
              />
              {material ? (
                <div className="mb-7 flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{material.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(material.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaterial(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                    aria-label="Bỏ tệp đã chọn"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mb-7 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center transition hover:border-[#b00020]/50 hover:bg-[#fff8f9]"
                >
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#b00020] shadow-sm">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-slate-800">Chọn tệp slide để tải lên</span>
                  <span className="mt-1 text-xs text-slate-500">PDF, PPT, PPTX hoặc ODP · tối đa 100 MB · 1 tệp</span>
                </button>
              )}

              <FieldLabel>Khối giảng dạy</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Khối giảng dạy">
                {TEACHING_BLOCKS.map((block) => {
                  const checked = teachingBlock === block.value
                  return (
                    <RadioTile
                      key={block.value}
                      checked={checked}
                      label={block.label}
                      description={block.detail}
                      onSelect={() => setTeachingBlock(block.value)}
                    />
                  )
                })}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || loadingOptions}
                className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-xl bg-[#b00020] px-6 text-sm font-bold text-white shadow-lg shadow-[#b00020]/20 transition hover:bg-[#93001b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? submittingStage || 'Đang gửi phiếu...' : 'Gửi phiếu'}
              </button>
            </div>
        </form>
      </PageLayoutContent>
    </PageLayout>
  )
}

function CandidateDropdown({
  candidates,
  onSelect,
}: {
  candidates: Candidate[]
  onSelect: (candidate: Candidate) => void
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-[65] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)]">
      {candidates.map((candidate) => (
        <button
          key={candidate.code}
          type="button"
          onClick={() => onSelect(candidate)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b00020]/8 text-[#a3001d]">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-slate-900">{candidate.full_name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{candidate.code}{candidate.center_name ? ` · ${candidate.center_name}` : ''}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
