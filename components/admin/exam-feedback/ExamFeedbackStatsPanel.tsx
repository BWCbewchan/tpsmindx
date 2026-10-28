'use client'
import { useQueryState } from '@/lib/use-query-state'



import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Inbox,
  Loader2,
  MessageSquareText,
  MonitorCog,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

type FeedbackStatus = 'new' | 'in_progress' | 'done'

interface FeedbackQuestion {
  id: number | null
  order_number: number | null
  question_text: string
}

interface FeedbackItem {
  id: number
  result_id: number
  set_id: number | null
  set_code: string | null
  set_name: string | null
  subject_code: string | null
  subject_name: string | null
  reviewer_email: string
  reviewer_code: string | null
  reviewer_name: string | null
  rating: number | null
  system_comment: string
  subject_comment: string
  status: FeedbackStatus
  handled_by_email: string | null
  handled_at: string | null
  submitted_at: string | null
  created_at: string
  questions: FeedbackQuestion[]
}

interface FeedbackSummary {
  total_reviews: number
  average_rating: number | null
  rating_count: number
  system_feedback_count: number
  subject_feedback_count: number
  pending_count: number
  rating_distribution: Record<string, number>
}

interface SubjectOption {
  code: string
  name: string | null
}

interface SetOption {
  id: number
  code: string | null
  name: string | null
  subject_code: string | null
}

interface FeedbackResponse {
  success: boolean
  error?: string
  summary: FeedbackSummary
  items: FeedbackItem[]
  filters: {
    subjects: SubjectOption[]
    sets: SetOption[]
  }
  pagination: {
    page: number
    page_size: number
    total: number
  }
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Mới',
  in_progress: 'Đang xử lý',
  done: 'Đã xử lý',
}

const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  new: 'border-amber-200 bg-amber-50 text-amber-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const NEXT_STATUS: Partial<Record<FeedbackStatus, FeedbackStatus>> = {
  new: 'in_progress',
  in_progress: 'done',
}

function stripHtml(value: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(value: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ExamFeedbackStatsPanel() {
  const { token } = useAuth()
  const [data, setData] = useState<FeedbackResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useQueryState<number>('examFeedbackPage', 1)
  const [month, setMonth] = useQueryState<string>('examFeedbackMonth', '')
  const [subjectCode, setSubjectCode] = useState('')
  const [setId, setSetId] = useState('')
  const [status, setStatus] = useState('')
  const [feedbackType, setFeedbackType] = useState('')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
      })
      if (month) params.set('month', month)
      if (subjectCode) params.set('subject_code', subjectCode)
      if (setId) params.set('set_id', setId)
      if (status) params.set('status', status)
      if (feedbackType) params.set('feedback_type', feedbackType)
      if (appliedQuery) params.set('query', appliedQuery)

      const response = await fetch(`/api/exam-feedback/admin?${params}`, {
        headers: authHeaders(token),
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Không thể tải thống kê đánh giá')
      }
      setData(payload)
    } catch (loadError) {
      console.error('[ExamFeedbackStatsPanel] load failed', loadError)
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải thống kê đánh giá',
      )
    } finally {
      setLoading(false)
    }
  }, [
    appliedQuery,
    feedbackType,
    month,
    page,
    setId,
    status,
    subjectCode,
    token,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredSetOptions = useMemo(() => {
    const sets = data?.filters?.sets || []
    return subjectCode
      ? sets.filter((item) => item.subject_code === subjectCode)
      : sets
  }, [data?.filters?.sets, subjectCode])

  useEffect(() => {
    if (
      setId &&
      !filteredSetOptions.some((item) => String(item.id) === String(setId))
    ) {
      setSetId('')
    }
  }, [filteredSetOptions, setId])

  const resetFilters = () => {
    setMonth('')
    setSubjectCode('')
    setSetId('')
    setStatus('')
    setFeedbackType('')
    setQuery('')
    setAppliedQuery('')
    setPage(1)
  }

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateStatus = async (item: FeedbackItem) => {
    const nextStatus = NEXT_STATUS[item.status]
    if (!nextStatus) return

    try {
      setUpdatingId(item.id)
      const response = await fetch('/api/exam-feedback/admin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ id: item.id, status: nextStatus }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Không thể cập nhật trạng thái')
      }
      toast.success(
        nextStatus === 'in_progress'
          ? 'Đã tiếp nhận đánh giá'
          : 'Đã hoàn thành xử lý đánh giá',
      )
      await loadData()
    } catch (updateError) {
      console.error('[ExamFeedbackStatsPanel] update failed', updateError)
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : 'Không thể cập nhật trạng thái',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const summary = data?.summary
  const totalPages = Math.max(
    1,
    Math.ceil((data?.pagination?.total || 0) / (data?.pagination?.page_size || 20)),
  )
  const maxRatingCount = Math.max(
    1,
    ...[1, 2, 3, 4, 5].map(
      (rating) => Number(summary?.rating_distribution?.[rating] || 0),
    ),
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Tổng đánh giá',
            value: summary?.total_reviews || 0,
            icon: MessageSquareText,
            tone: 'border-slate-200 bg-white text-slate-700',
          },
          {
            label: 'Rating trung bình',
            value:
              summary?.average_rating == null
                ? 'Chưa có'
                : `${summary.average_rating.toFixed(2)}/5`,
            icon: Star,
            tone: 'border-amber-200 bg-amber-50 text-amber-700',
          },
          {
            label: 'Feedback hệ thống',
            value: summary?.system_feedback_count || 0,
            icon: MonitorCog,
            tone: 'border-sky-200 bg-sky-50 text-sky-700',
          },
          {
            label: 'Feedback chuyên môn',
            value: summary?.subject_feedback_count || 0,
            icon: BookOpenCheck,
            tone: 'border-rose-200 bg-rose-50 text-rose-700',
          },
          {
            label: 'Chưa hoàn tất',
            value: summary?.pending_count || 0,
            icon: Clock3,
            tone: 'border-violet-200 bg-violet-50 text-violet-700',
          },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={`rounded-xl border p-4 shadow-sm ${card.tone}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {card.label}
                </p>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-2xl font-bold">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_2.15fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Phân bố rating</h3>
              <p className="text-xs text-slate-500">
                {summary?.rating_count || 0} đánh giá có chọn sao
              </p>
            </div>
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </div>
          <div className="mt-5 space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = Number(
                summary?.rating_distribution?.[rating] || 0,
              )
              return (
                <div key={rating} className="grid grid-cols-[42px_1fr_30px] items-center gap-2">
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                    {rating}
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${(count / maxRatingCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-right text-xs font-semibold text-slate-500">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">
              Tháng làm bài
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setPage(1)
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/10"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Môn
              <select
                value={subjectCode}
                onChange={(event) => {
                  setSubjectCode(event.target.value)
                  setPage(1)
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#a1001f]"
              >
                <option value="">Tất cả môn</option>
                {(data?.filters?.subjects || []).map((subject) => (
                  <option key={subject.code} value={subject.code}>
                    {subject.name || subject.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Bộ đề
              <select
                value={setId}
                onChange={(event) => {
                  setSetId(event.target.value)
                  setPage(1)
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#a1001f]"
              >
                <option value="">Tất cả bộ đề</option>
                {filteredSetOptions.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.code || `#${set.id}`}
                    {set.name ? ` - ${set.name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Trạng thái
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#a1001f]"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="new">Mới</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="done">Đã xử lý</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Loại feedback
              <select
                value={feedbackType}
                onChange={(event) => {
                  setFeedbackType(event.target.value)
                  setPage(1)
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#a1001f]"
              >
                <option value="">Tất cả loại</option>
                <option value="rating">Có rating</option>
                <option value="system">Hệ thống</option>
                <option value="subject">Chuyên môn</option>
              </select>
            </label>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setAppliedQuery(query.trim())
                setPage(1)
              }}
            >
              <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">
                Tìm mentor
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tên, email, mã GV..."
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#a1001f]"
                  />
                </div>
              </label>
              <Button type="submit" variant="outline" size="sm">
                Lọc
              </Button>
            </form>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
              Làm mới
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-700">{error}</p>
          <Button className="mt-4" variant="outline" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      ) : loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải dữ liệu đánh giá...
          </div>
        </div>
      ) : !data?.items?.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Inbox className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">
            Chưa có đánh giá phù hợp
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Dữ liệu sẽ xuất hiện sau khi mentor gửi rating hoặc feedback.
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mentor</TableHead>
                <TableHead>Môn / Bộ đề</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Loại feedback</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const expanded = expandedIds.has(item.id)
                const nextStatus = NEXT_STATUS[item.status]
                return (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell>
                        <p className="font-semibold text-slate-900">
                          {item.reviewer_name || item.reviewer_code || 'Mentor'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.reviewer_code || 'Chưa có mã'} · {item.reviewer_email}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Làm bài: {formatDate(item.submitted_at)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-900">
                          {item.subject_name || item.subject_code || 'Chưa rõ môn'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.set_code || `#${item.set_id || ''}`}
                          {item.set_name ? ` - ${item.set_name}` : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        {item.rating ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                            {item.rating}/5
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Không chọn</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {item.system_comment ? (
                            <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                              Hệ thống
                            </span>
                          ) : null}
                          {item.subject_comment ? (
                            <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                              Chuyên môn
                            </span>
                          ) : null}
                          {item.rating ? (
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                              Rating
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpanded(item.id)}
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            Chi tiết
                          </Button>
                          {nextStatus ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                nextStatus === 'done' ? 'success' : 'default'
                              }
                              loading={updatingId === item.id}
                              onClick={() => updateStatus(item)}
                            >
                              {nextStatus === 'done' ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                              {nextStatus === 'done'
                                ? 'Hoàn tất'
                                : 'Tiếp nhận'}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow key={`${item.id}-detail`} className="bg-slate-50/70">
                        <TableCell colSpan={6}>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border border-sky-100 bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                                Feedback hệ thống
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {item.system_comment || 'Không có nội dung'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-rose-100 bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                                Feedback chuyên môn
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {item.subject_comment || 'Không có nội dung'}
                              </p>
                            </div>
                          </div>
                          {item.questions?.length > 0 ? (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                                Câu hỏi liên quan
                              </p>
                              <div className="mt-3 space-y-2">
                                {item.questions.map((question, index) => (
                                  <div
                                    key={`${item.id}-${question.id || index}`}
                                    className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                  >
                                    <strong className="mr-1 text-slate-900">
                                      Câu {question.order_number ?? index + 1}:
                                    </strong>
                                    {stripHtml(question.question_text) ||
                                      'Không có nội dung xem trước'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                            <span>Gửi lúc: {formatDate(item.created_at)}</span>
                            {item.handled_by_email ? (
                              <span>
                                Người xử lý: {item.handled_by_email}
                              </span>
                            ) : null}
                            {item.handled_at ? (
                              <span>Hoàn tất: {formatDate(item.handled_at)}</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Hiển thị {data.items.length} / {data.pagination.total} đánh giá
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </Button>
              <span className="px-2 text-sm font-semibold text-slate-700">
                {page}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
